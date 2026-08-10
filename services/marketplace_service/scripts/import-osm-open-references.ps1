[CmdletBinding()]
param(
  [ValidateRange(100, 100000)]
  [int]$TargetCount = 10000,

  [ValidateRange(1, 30)]
  [int]$MinimumCities = 3,

  [switch]$CacheOnly,

  [string]$EnvFile = ".env.development"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Get-TagValue {
  param(
    [AllowNull()]$Tags,
    [Parameter(Mandatory = $true)][string]$Name
  )

  if ($null -eq $Tags) { return "" }
  $property = $Tags.PSObject.Properties[$Name]
  if ($null -eq $property -or $null -eq $property.Value) { return "" }
  return [string]$property.Value
}

function Clean-ReferenceText {
  param(
    [AllowNull()]$Value,
    [int]$MaximumLength = 180
  )

  if ($null -eq $Value) { return "" }
  $clean = ([string]$Value -replace "[\x00-\x1F\x7F]", " " -replace "\s+", " ").Trim()
  if ($clean.Length -gt $MaximumLength) {
    return $clean.Substring(0, $MaximumLength).Trim()
  }
  return $clean
}

function Test-ContainsPrivateContactText {
  param([AllowNull()]$Value)

  if ($null -eq $Value) { return $false }
  $text = [string]$Value
  return (
    $text -match "(?i)@[a-z0-9.-]+\.[a-z]{2,}" -or
    $text -match "(?<!\d)(?:\+?62|0)[\d\s().-]{7,}\d(?!\d)"
  )
}

function Test-UsableReferenceName {
  param([AllowNull()]$Value)

  $name = Clean-ReferenceText -Value $Value -MaximumLength 180
  if ($name.Length -lt 2) { return $false }
  if ($name -notmatch "[\p{L}]") { return $false }
  if (
    $name -match "(?i)^(yes|no|unknown|unnamed|test|bengkel|fotocopy|kantor|kios|laundry|market|minimarket|office|pasar|ruko|shop|store|supermarket|toko|warung)$"
  ) {
    return $false
  }
  if ($name -match "(?i)^(?:https?://|www\.)") {
    return $false
  }
  if (Test-ContainsPrivateContactText -Value $name) { return $false }
  return $true
}

function Test-ProhibitedConsumerChainName {
  param([AllowNull()]$Value)

  $name = Clean-ReferenceText -Value $Value -MaximumLength 180
  if (-not $name) { return $false }
  return $name -match (
    "(?i)^(?:indomaret|alfamart|alfamidi|circle\s*k|super\s*indo|" +
    "lawson|transmart|hypermart|familymart|farmers\s*market|" +
    "ranch\s*market|lotte\s*mart)(?:\b|\s|-)"
  )
}

function Test-OperationalReference {
  param([Parameter(Mandatory = $true)]$Tags)

  $shop = (Get-TagValue -Tags $Tags -Name "shop").ToLowerInvariant()
  if (
    $shop -in @(
      "abandoned", "closed", "construction", "demolished", "disused", "no",
      "proposed", "razed", "removed", "vacant"
    )
  ) {
    return $false
  }

  foreach ($key in @(
    "abandoned", "construction", "demolished", "disused", "proposed",
    "razed", "removed", "vacant"
  )) {
    $value = (Get-TagValue -Tags $Tags -Name $key).ToLowerInvariant()
    if ($value -and $value -notin @("no", "false", "0")) { return $false }
  }

  foreach ($property in $Tags.PSObject.Properties) {
    if (
      $property.Name -match "^(?i:abandoned|construction|demolished|disused|proposed|razed|removed|vacant):(shop|craft|office|industrial|amenity)$"
    ) {
      return $false
    }
  }

  return $true
}

function Clean-ReferenceDescription {
  param([AllowNull()]$Value)

  $description = Clean-ReferenceText -Value $Value -MaximumLength 500
  if (Test-ContainsPrivateContactText -Value $description) {
    return ""
  }
  return $description
}

function Resolve-ReferenceAddress {
  param(
    [Parameter(Mandatory = $true)]$Tags,
    [Parameter(Mandatory = $true)][string]$FallbackCity
  )

  $full = Clean-ReferenceText -Value (Get-TagValue -Tags $Tags -Name "addr:full") -MaximumLength 300
  if ($full -and -not (Test-ContainsPrivateContactText -Value $full)) {
    return $full
  }

  $parts = @(
    (Clean-ReferenceText -Value (Get-TagValue -Tags $Tags -Name "addr:housenumber") -MaximumLength 40),
    (Clean-ReferenceText -Value (Get-TagValue -Tags $Tags -Name "addr:street") -MaximumLength 140),
    (Clean-ReferenceText -Value (Get-TagValue -Tags $Tags -Name "addr:suburb") -MaximumLength 100),
    (Clean-ReferenceText -Value (Get-TagValue -Tags $Tags -Name "addr:district") -MaximumLength 100),
    $FallbackCity,
    (Clean-ReferenceText -Value (Get-TagValue -Tags $Tags -Name "addr:postcode") -MaximumLength 20)
  ) | Where-Object { $_ }

  $resolved = Clean-ReferenceText -Value ($parts -join ", ") -MaximumLength 300
  if (Test-ContainsPrivateContactText -Value $resolved) {
    return Clean-ReferenceText -Value $FallbackCity -MaximumLength 120
  }
  return $resolved
}

function Resolve-SafeWebsite {
  param([Parameter(Mandatory = $true)]$Tags)

  $candidate = Clean-ReferenceText -Value (Get-TagValue -Tags $Tags -Name "website") -MaximumLength 500
  if (-not $candidate) {
    $candidate = Clean-ReferenceText -Value (Get-TagValue -Tags $Tags -Name "contact:website") -MaximumLength 500
  }
  if ($candidate -notmatch "^https?://") { return "" }
  return $candidate
}

function Resolve-ReferenceClassification {
  param([Parameter(Mandatory = $true)]$Tags)

  $amenity = (Get-TagValue -Tags $Tags -Name "amenity").ToLowerInvariant()
  $shop = (Get-TagValue -Tags $Tags -Name "shop").ToLowerInvariant()
  $craft = (Get-TagValue -Tags $Tags -Name "craft").ToLowerInvariant()
  $office = (Get-TagValue -Tags $Tags -Name "office").ToLowerInvariant()
  $industrial = (Get-TagValue -Tags $Tags -Name "industrial").ToLowerInvariant()

  $blockedShops = @(
    "alcohol", "bookmaker", "cannabis", "e-cigarette", "erotic",
    "lottery", "tobacco", "weapons"
  )
  if ($blockedShops -contains $shop) { return $null }

  if ($amenity -eq "marketplace") {
    return [pscustomobject]@{
      Category = "business-places"
      Subcategory = "booths-stalls"
      ContentType = "property"
      LegacyCategory = "property"
      CreateCategory = "property"
      PrimaryKey = "amenity"
      PrimaryValue = $amenity
    }
  }

  if ($office) {
    $allowedOffices = @(
      "accountant", "accounting", "advertising_agency", "architect",
      "company", "consulting", "coworking", "employment_agency",
      "estate_agent", "financial", "insurance", "it", "lawyer",
      "logistics", "notary", "property_management", "research",
      "tax_advisor", "telecommunication", "travel_agent", "web_design"
    )
    if ($allowedOffices -notcontains $office) { return $null }

    $subcategory = switch -Regex ($office) {
      "accountant|financial|tax" { "finance-accounting"; break }
      "lawyer|notary|government" { "legal-licensing"; break }
      "it|telecommunication|software|web_design" { "digital-technology"; break }
      "advertising|marketing" { "marketing"; break }
      "logistics|courier|transport" { "logistics-delivery"; break }
      default { "business-operations" }
    }
    return [pscustomobject]@{
      Category = "services"
      Subcategory = $subcategory
      ContentType = "service"
      LegacyCategory = "service"
      CreateCategory = "service"
      PrimaryKey = "office"
      PrimaryValue = $office
    }
  }

  if ($craft) {
    return [pscustomobject]@{
      Category = "services"
      Subcategory = "production-manufacturing"
      ContentType = "service"
      LegacyCategory = "service"
      CreateCategory = "service"
      PrimaryKey = "craft"
      PrimaryValue = $craft
    }
  }

  if ($industrial) {
    return [pscustomobject]@{
      Category = "materials-suppliers"
      Subcategory = "direct-manufacturers"
      ContentType = "product"
      LegacyCategory = "supplies"
      CreateCategory = "supplies"
      PrimaryKey = "industrial"
      PrimaryValue = $industrial
    }
  }

  $businessPlaceShops = @{
    "department_store" = "shared-business-spaces"
    "kiosk" = "kiosks"
    "mall" = "shared-business-spaces"
    "photo_studio" = "studios"
    "shopping_centre" = "shared-business-spaces"
    "storage_rental" = "warehouses"
  }
  if ($businessPlaceShops.ContainsKey($shop)) {
    return [pscustomobject]@{
      Category = "business-places"
      Subcategory = $businessPlaceShops[$shop]
      ContentType = "property"
      LegacyCategory = "property"
      CreateCategory = "property"
      PrimaryKey = "shop"
      PrimaryValue = $shop
    }
  }

  $machineShops = @(
    "agricultural_engines", "appliance", "car_parts", "computer",
    "doityourself", "electrical", "electronics", "furniture", "hardware",
    "kitchen", "lighting", "machine", "medical_supply", "motorcycle_parts",
    "office_supplies", "printer_ink", "radiotechnics", "security",
    "stationery", "tool_hire", "tyres"
  )
  if ($machineShops -contains $shop) {
    $subcategory = switch -Regex ($shop) {
      "agricultural" { "agricultural-tools"; break }
      "car_parts|motorcycle_parts|tyres" { "spare-parts-components"; break }
      "computer|electrical|electronics|office_supplies|printer_ink|radiotechnics|security|stationery" { "office-equipment"; break }
      "tool_hire" { "equipment-rental"; break }
      default { "workshop-tools" }
    }
    return [pscustomobject]@{
      Category = "machines-tools"
      Subcategory = $subcategory
      ContentType = "product"
      LegacyCategory = "equipment"
      CreateCategory = "equipment"
      PrimaryKey = "shop"
      PrimaryValue = $shop
    }
  }

  $serviceShops = @(
    "car_repair", "copyshop", "dry_cleaning", "estate_agent", "laundry",
    "locksmith", "motorcycle_repair", "photo", "printing", "repair", "tailor",
    "travel_agency"
  )
  if ($serviceShops -contains $shop) {
    $subcategory = switch -Regex ($shop) {
      "copyshop|photo|printing" { "creative-design"; break }
      "estate_agent|travel_agency" { "business-operations"; break }
      "laundry|dry_cleaning" { "business-operations"; break }
      "repair|locksmith" { "technical-repair"; break }
      default { "field-workforce" }
    }
    return [pscustomobject]@{
      Category = "services"
      Subcategory = $subcategory
      ContentType = "service"
      LegacyCategory = "service"
      CreateCategory = "service"
      PrimaryKey = "shop"
      PrimaryValue = $shop
    }
  }

  $materialShops = @(
    "agrarian", "animal_feed", "bathroom_furnishing", "beverages",
    "building_materials", "butcher", "carpet", "ceramics", "coffee", "curtain",
    "dairy", "doors", "fabric", "farm", "flooring", "frozen_food", "gas",
    "garden_centre", "glass", "greengrocer", "health_food", "herbalist",
    "leather", "nuts", "packaging", "paint", "pasta", "rice", "roofing",
    "seafood", "spices", "tea", "tiles", "trade", "water", "wholesale",
    "windows"
  )
  if ($materialShops -notcontains $shop) { return $null }

  $subcategory = if ($shop -match "wholesale|trade") {
    "wholesale-stock"
  } elseif ($shop -match "packaging") {
    "business-packaging"
  } elseif (
    $shop -match "farm|agrarian|animal_feed|beverages|butcher|coffee|dairy|frozen_food|garden_centre|greengrocer|health_food|herbalist|nuts|pasta|rice|seafood|spices|tea|water"
  ) {
    "raw-materials"
  } else {
    "resale-products"
  }

  return [pscustomobject]@{
    Category = "materials-suppliers"
    Subcategory = $subcategory
    ContentType = "product"
    LegacyCategory = "supplies"
    CreateCategory = "supplies"
    PrimaryKey = "shop"
    PrimaryValue = $shop
  }
}

function Test-ValidOverpassResponse {
  param([AllowNull()]$Response)

  if ($null -eq $Response) { return $false }
  if ($null -eq $Response.PSObject.Properties["elements"]) { return $false }
  $remark = Clean-ReferenceText -Value $Response.remark -MaximumLength 500
  if ($remark) { return $false }
  $timestamp = Clean-ReferenceText -Value $Response.osm3s.timestamp_osm_base -MaximumLength 80
  if (-not $timestamp) { return $false }
  try {
    $parsedTimestamp = [DateTimeOffset]::Parse(
      $timestamp,
      [System.Globalization.CultureInfo]::InvariantCulture
    )
  } catch {
    return $false
  }
  if ($parsedTimestamp.UtcDateTime -gt [DateTime]::UtcNow.AddMinutes(5)) {
    return $false
  }
  return $true
}

function Invoke-OverpassQuery {
  param(
    [Parameter(Mandatory = $true)]$City,
    [Parameter(Mandatory = $true)][string[]]$Endpoints
  )

  $query = @"
[out:json][timeout:110];
(
  nwr(around:$($City.Radius),$($City.Lat),$($City.Lng))["name"]["shop"];
  nwr(around:$($City.Radius),$($City.Lat),$($City.Lng))["name"]["craft"];
  nwr(around:$($City.Radius),$($City.Lat),$($City.Lng))["name"]["office"];
  nwr(around:$($City.Radius),$($City.Lat),$($City.Lng))["name"]["industrial"];
  nwr(around:$($City.Radius),$($City.Lat),$($City.Lng))["name"]["amenity"="marketplace"];
);
out center tags;
"@

  $lastError = $null
  foreach ($endpoint in $Endpoints) {
    try {
      Write-Host "Mengambil referensi $($City.Name) dari $endpoint ..."
      return Invoke-RestMethod `
        -Uri $endpoint `
        -Method Post `
        -Headers @{ "User-Agent" = "Lajukan-local-open-reference-importer/1.0 (non-transactional ODbL catalog)" } `
        -ContentType "application/x-www-form-urlencoded" `
        -Body @{ data = $query } `
        -TimeoutSec 125
    } catch {
      $lastError = $_
      Write-Warning "Endpoint gagal untuk $($City.Name): $endpoint"
    }
  }

  throw "Semua endpoint Overpass gagal untuk $($City.Name): $($lastError.Exception.Message)"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$resolvedEnvFile = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
  $EnvFile
} else {
  Join-Path $repoRoot $EnvFile
}
if (-not (Test-Path -LiteralPath $resolvedEnvFile)) {
  throw "Env file tidak ditemukan: $resolvedEnvFile"
}

$cities = @(
  [pscustomobject]@{ Name = "Jakarta"; Lat = -6.2088; Lng = 106.8456; Radius = 20000 },
  [pscustomobject]@{ Name = "Bogor"; Lat = -6.5950; Lng = 106.8166; Radius = 15000 },
  [pscustomobject]@{ Name = "Tangerang"; Lat = -6.1783; Lng = 106.6319; Radius = 15000 },
  [pscustomobject]@{ Name = "Bekasi"; Lat = -6.2383; Lng = 106.9756; Radius = 15000 },
  [pscustomobject]@{ Name = "Bandung"; Lat = -6.9175; Lng = 107.6191; Radius = 18000 },
  [pscustomobject]@{ Name = "Surabaya"; Lat = -7.2575; Lng = 112.7521; Radius = 18000 },
  [pscustomobject]@{ Name = "Medan"; Lat = 3.5952; Lng = 98.6722; Radius = 18000 },
  [pscustomobject]@{ Name = "Semarang"; Lat = -6.9667; Lng = 110.4167; Radius = 16000 },
  [pscustomobject]@{ Name = "Makassar"; Lat = -5.1477; Lng = 119.4327; Radius = 16000 },
  [pscustomobject]@{ Name = "Yogyakarta"; Lat = -7.7956; Lng = 110.3695; Radius = 15000 },
  [pscustomobject]@{ Name = "Denpasar"; Lat = -8.6500; Lng = 115.2167; Radius = 15000 },
  [pscustomobject]@{ Name = "Palembang"; Lat = -2.9761; Lng = 104.7754; Radius = 16000 },
  [pscustomobject]@{ Name = "Bandar Lampung"; Lat = -5.3971; Lng = 105.2668; Radius = 15000 },
  [pscustomobject]@{ Name = "Pekanbaru"; Lat = 0.5071; Lng = 101.4478; Radius = 16000 },
  [pscustomobject]@{ Name = "Padang"; Lat = -0.9471; Lng = 100.4172; Radius = 15000 },
  [pscustomobject]@{ Name = "Batam"; Lat = 1.0456; Lng = 104.0305; Radius = 16000 },
  [pscustomobject]@{ Name = "Banda Aceh"; Lat = 5.5483; Lng = 95.3238; Radius = 13000 },
  [pscustomobject]@{ Name = "Jambi"; Lat = -1.6101; Lng = 103.6131; Radius = 14000 },
  [pscustomobject]@{ Name = "Pontianak"; Lat = -0.0263; Lng = 109.3425; Radius = 15000 },
  [pscustomobject]@{ Name = "Banjarmasin"; Lat = -3.3186; Lng = 114.5944; Radius = 15000 },
  [pscustomobject]@{ Name = "Samarinda"; Lat = -0.5022; Lng = 117.1536; Radius = 15000 },
  [pscustomobject]@{ Name = "Balikpapan"; Lat = -1.2379; Lng = 116.8529; Radius = 15000 },
  [pscustomobject]@{ Name = "Manado"; Lat = 1.4748; Lng = 124.8421; Radius = 14000 },
  [pscustomobject]@{ Name = "Malang"; Lat = -7.9666; Lng = 112.6326; Radius = 15000 },
  [pscustomobject]@{ Name = "Surakarta"; Lat = -7.5755; Lng = 110.8243; Radius = 14000 },
  [pscustomobject]@{ Name = "Cirebon"; Lat = -6.7320; Lng = 108.5523; Radius = 12000 },
  [pscustomobject]@{ Name = "Tasikmalaya"; Lat = -7.3274; Lng = 108.2207; Radius = 12000 },
  [pscustomobject]@{ Name = "Mataram"; Lat = -8.5833; Lng = 116.1167; Radius = 13000 },
  [pscustomobject]@{ Name = "Kupang"; Lat = -10.1772; Lng = 123.6070; Radius = 13000 },
  [pscustomobject]@{ Name = "Jayapura"; Lat = -2.5337; Lng = 140.7181; Radius = 12000 }
)
$endpoints = @(
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter"
)

$runtimeDirectory = Join-Path $repoRoot ".runtime\imports"
$overpassCacheDirectory = Join-Path $runtimeDirectory "overpass-cache"
New-Item -ItemType Directory -Force -Path $overpassCacheDirectory | Out-Null
$importLockPath = Join-Path $runtimeDirectory "osm-open-reference-import.lock"
try {
  $importLockStream = [System.IO.File]::Open(
    $importLockPath,
    [System.IO.FileMode]::OpenOrCreate,
    [System.IO.FileAccess]::ReadWrite,
    [System.IO.FileShare]::None
  )
} catch {
  throw "Importer OSM lain sedang berjalan atau lock tidak dapat dibuka: $importLockPath"
}

try {
$upsertSourcePath = Join-Path $PSScriptRoot "osm-open-reference-upsert.sql"
$upsertSnapshotPath = Join-Path $runtimeDirectory "osm-open-reference-upsert.snapshot.sql"
Copy-Item -LiteralPath $upsertSourcePath -Destination $upsertSnapshotPath -Force
$deduplicated = @{}
$policyRejected = @{}
$citiesFetched = 0
$citiesSkipped = New-Object System.Collections.ArrayList
$rawGoal = [math]::Ceiling($TargetCount * 1.2)
$accessedAt = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")

foreach ($city in $cities) {
  $cacheName = ($city.Name.ToLowerInvariant() -replace "[^a-z0-9]+", "-").Trim("-")
  $cachePath = Join-Path $overpassCacheDirectory "$cacheName.json"
  $response = $null
  $cityAccessedAt = $accessedAt
  if (Test-Path -LiteralPath $cachePath) {
    $cacheItem = Get-Item -LiteralPath $cachePath
    if ($cacheItem.LastWriteTimeUtc -ge [DateTime]::UtcNow.AddDays(-7)) {
      try {
        $response = Get-Content -LiteralPath $cachePath -Raw -Encoding UTF8 |
          ConvertFrom-Json
        if (Test-ValidOverpassResponse -Response $response) {
          $cityAccessedAt = $cacheItem.LastWriteTimeUtc.ToString("yyyy-MM-ddTHH:mm:ssZ")
          Write-Host "Memakai cache referensi $($city.Name)."
        } else {
          Write-Warning "Cache $($city.Name) tidak lolos validasi snapshot; mengambil ulang."
          $response = $null
        }
      } catch {
        Write-Warning "Cache $($city.Name) rusak; mengambil ulang dari sumber."
        $response = $null
      }
    }
  }

  if ($null -eq $response) {
    if ($CacheOnly) {
      [void]$citiesSkipped.Add($city.Name)
      Write-Warning "Wilayah $($city.Name) dilewati karena tidak memiliki cache valid dan -CacheOnly aktif."
      continue
    }

    try {
      $response = Invoke-OverpassQuery -City $city -Endpoints $endpoints
      if (-not (Test-ValidOverpassResponse -Response $response)) {
        throw "Respons Overpass tidak memiliki snapshot elements/timestamp yang valid."
      }
      $cityAccessedAt = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
      $response |
        ConvertTo-Json -Depth 12 -Compress |
        Set-Content -LiteralPath $cachePath -Encoding UTF8
    } catch {
      [void]$citiesSkipped.Add($city.Name)
      Write-Warning "Wilayah $($city.Name) dilewati setelah semua endpoint gagal."
      continue
    }
  }

  $citiesFetched += 1
  $elements = @($response.elements)
  Write-Host "  $($elements.Count) elemen diterima."

  foreach ($element in $elements) {
    $osmType = Clean-ReferenceText -Value $element.type -MaximumLength 12
    $osmId = Clean-ReferenceText -Value $element.id -MaximumLength 30
    if ($osmType -notin @("node", "way", "relation") -or $osmId -notmatch "^[0-9]+$") {
      continue
    }
    $externalId = "$osmType/$osmId"

    $name = Clean-ReferenceText -Value (Get-TagValue -Tags $element.tags -Name "name")
    if (-not (Test-UsableReferenceName -Value $name)) {
      if (-not $policyRejected.ContainsKey($externalId)) {
        $policyRejected[$externalId] = [pscustomobject]@{
          external_id = $externalId
          reason = "unsafe_name"
        }
      }
      continue
    }
    if (Test-ProhibitedConsumerChainName -Value $name) {
      if (-not $policyRejected.ContainsKey($externalId)) {
        $policyRejected[$externalId] = [pscustomobject]@{
          external_id = $externalId
          reason = "consumer_retail_chain"
        }
      }
      continue
    }
    if (-not (Test-OperationalReference -Tags $element.tags)) {
      if (-not $policyRejected.ContainsKey($externalId)) {
        $policyRejected[$externalId] = [pscustomobject]@{
          external_id = $externalId
          reason = "non_operational_lifecycle"
        }
      }
      continue
    }

    $lat = if ($null -ne $element.lat) { [double]$element.lat } elseif ($null -ne $element.center.lat) { [double]$element.center.lat } else { $null }
    $lng = if ($null -ne $element.lon) { [double]$element.lon } elseif ($null -ne $element.center.lon) { [double]$element.center.lon } else { $null }
    if ($null -eq $lat -or $null -eq $lng -or [math]::Abs($lat) -gt 90 -or [math]::Abs($lng) -gt 180) {
      continue
    }

    $reportedCity = Clean-ReferenceText -Value (Get-TagValue -Tags $element.tags -Name "addr:city") -MaximumLength 120
    if (-not $reportedCity) {
      $reportedCity = Clean-ReferenceText -Value (Get-TagValue -Tags $element.tags -Name "addr:municipality") -MaximumLength 120
    }
    if (-not $reportedCity) { $reportedCity = $city.Name }

    $classification = Resolve-ReferenceClassification -Tags $element.tags
    if ($null -eq $classification) {
      if (-not $policyRejected.ContainsKey($externalId)) {
        $policyRejected[$externalId] = [pscustomobject]@{
          external_id = $externalId
          reason = "category_not_allowed"
        }
      }
      continue
    }
    $address = Resolve-ReferenceAddress -Tags $element.tags -FallbackCity $reportedCity
    if (-not $deduplicated.ContainsKey($externalId)) {
      $deduplicated[$externalId] = [pscustomobject]@{
        osm_type = $osmType
        osm_id = $osmId
        name = $name
        city = $reportedCity
        address = $address
        latitude = $lat.ToString([System.Globalization.CultureInfo]::InvariantCulture)
        longitude = $lng.ToString([System.Globalization.CultureInfo]::InvariantCulture)
        brand = Clean-ReferenceDescription -Value (Get-TagValue -Tags $element.tags -Name "brand")
        operator = Clean-ReferenceDescription -Value (Get-TagValue -Tags $element.tags -Name "operator")
        description = Clean-ReferenceDescription -Value (Get-TagValue -Tags $element.tags -Name "description")
        opening_hours = Clean-ReferenceText -Value (Get-TagValue -Tags $element.tags -Name "opening_hours") -MaximumLength 300
        website = Resolve-SafeWebsite -Tags $element.tags
        wikimedia_commons = Clean-ReferenceText -Value (Get-TagValue -Tags $element.tags -Name "wikimedia_commons") -MaximumLength 500
        wikidata = Clean-ReferenceText -Value (Get-TagValue -Tags $element.tags -Name "wikidata") -MaximumLength 80
        brand_wikidata = Clean-ReferenceText -Value (Get-TagValue -Tags $element.tags -Name "brand:wikidata") -MaximumLength 80
        operator_wikidata = Clean-ReferenceText -Value (Get-TagValue -Tags $element.tags -Name "operator:wikidata") -MaximumLength 80
        image_ref = Clean-ReferenceText -Value (Get-TagValue -Tags $element.tags -Name "image") -MaximumLength 500
        primary_key = $classification.PrimaryKey
        primary_value = $classification.PrimaryValue
        marketplace_category_slug = $classification.Category
        marketplace_subcategory_slug = $classification.Subcategory
        content_type = $classification.ContentType
        legacy_category = $classification.LegacyCategory
        create_category = $classification.CreateCategory
        accessed_at = $cityAccessedAt
      }
    }
  }

  Write-Host "  $($deduplicated.Count) referensi unik terkumpul."
  if ($citiesFetched -ge $MinimumCities -and $deduplicated.Count -ge $rawGoal) {
    break
  }
}

if ($citiesFetched -lt $MinimumCities) {
  throw "Hanya $citiesFetched wilayah berhasil; minimum $MinimumCities belum tercapai."
}

$selectionTarget = [math]::Min($TargetCount, $deduplicated.Count)
if ($selectionTarget -lt $TargetCount) {
  Write-Warning "Target $TargetCount belum tercapai. Mengimpor maksimum $selectionTarget referensi yang berhasil diaudit."
}

# Round-robin city/category buckets prevents one metro or category from taking the
# entire catalog when the source returns more rows than the configured target.
$buckets = @{}
foreach ($record in $deduplicated.Values) {
  $bucketKey = "$($record.city)|$($record.marketplace_category_slug)"
  if (-not $buckets.ContainsKey($bucketKey)) {
    $buckets[$bucketKey] = New-Object System.Collections.ArrayList
  }
  [void]$buckets[$bucketKey].Add($record)
}
foreach ($bucketKey in @($buckets.Keys)) {
  $buckets[$bucketKey] = @($buckets[$bucketKey] | Sort-Object osm_type, osm_id)
}

$selected = New-Object System.Collections.ArrayList
$bucketIndexes = @{}
$bucketKeys = @($buckets.Keys | Sort-Object)
foreach ($bucketKey in $bucketKeys) { $bucketIndexes[$bucketKey] = 0 }

while ($selected.Count -lt $selectionTarget) {
  $added = 0
  foreach ($bucketKey in $bucketKeys) {
    $index = [int]$bucketIndexes[$bucketKey]
    $bucket = $buckets[$bucketKey]
    if ($index -lt $bucket.Count) {
      [void]$selected.Add($bucket[$index])
      $bucketIndexes[$bucketKey] = $index + 1
      $added += 1
      if ($selected.Count -ge $selectionTarget) { break }
    }
  }
  if ($added -eq 0) { break }
}

$csvPath = Join-Path $runtimeDirectory "osm-open-references.csv"
$selected | Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding UTF8
$policyRejectedPath = Join-Path $runtimeDirectory "osm-open-references-policy-rejected.csv"
$policyRejectedOutput = @(
  $policyRejected.Values |
    Where-Object { -not $deduplicated.ContainsKey($_.external_id) } |
    Sort-Object external_id
)
if ($policyRejectedOutput.Count -gt 0) {
  $policyRejectedOutput |
    Export-Csv -LiteralPath $policyRejectedPath -NoTypeInformation -Encoding UTF8
} else {
  '"external_id","reason"' |
    Set-Content -LiteralPath $policyRejectedPath -Encoding UTF8
}
Write-Host "$($selected.Count) referensi siap diimpor dari $citiesFetched wilayah."
Write-Host "$($policyRejectedOutput.Count) referensi sumber ditandai tidak lolos kebijakan."
if ($citiesSkipped.Count -gt 0) {
  Write-Warning "Wilayah yang dilewati: $($citiesSkipped -join ', ')."
}

$composeArgs = @("compose", "--env-file", $resolvedEnvFile)
$containerId = (& docker @composeArgs "ps" "-q" "marketplace_db").Trim()
if ($LASTEXITCODE -ne 0 -or -not $containerId) {
  throw "Container marketplace_db tidak berjalan. Jalankan .\up-super-fast.ps1 terlebih dahulu."
}

$migrationPath = Join-Path $repoRoot "services\marketplace_service\migrations\20260730130000_openstreetmap_reference_import_indexes.up.sql"
$upsertPath = $upsertSnapshotPath

& docker cp $csvPath "${containerId}:/tmp/lajukan-osm-open-references.csv"
if ($LASTEXITCODE -ne 0) { throw "Gagal menyalin CSV ke marketplace_db." }
& docker cp $policyRejectedPath "${containerId}:/tmp/lajukan-osm-open-references-policy-rejected.csv"
if ($LASTEXITCODE -ne 0) { throw "Gagal menyalin CSV penolakan kebijakan ke marketplace_db." }
& docker cp $migrationPath "${containerId}:/tmp/lajukan-osm-reference-indexes.sql"
if ($LASTEXITCODE -ne 0) { throw "Gagal menyalin migration ke marketplace_db." }
& docker cp $upsertPath "${containerId}:/tmp/lajukan-osm-reference-upsert.sql"
if ($LASTEXITCODE -ne 0) { throw "Gagal menyalin SQL importer ke marketplace_db." }

$hostSqlHash = (Get-FileHash -LiteralPath $upsertPath -Algorithm SHA256).Hash.ToLowerInvariant()
$containerHashOutput = (& docker exec $containerId sha256sum /tmp/lajukan-osm-reference-upsert.sql).Trim()
if ($LASTEXITCODE -ne 0 -or -not $containerHashOutput) {
  throw "Gagal memverifikasi checksum SQL importer di container."
}
$containerSqlHash = ($containerHashOutput -split "\s+")[0].ToLowerInvariant()
if ($hostSqlHash -ne $containerSqlHash) {
  throw "Checksum SQL importer host/container tidak cocok."
}

& docker exec $containerId sh -lc 'exec psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/lajukan-osm-reference-indexes.sql'
if ($LASTEXITCODE -ne 0) { throw "Gagal menerapkan indeks referensi." }
& docker exec $containerId sh -lc 'exec psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/lajukan-osm-reference-upsert.sql'
if ($LASTEXITCODE -ne 0) { throw "Gagal mengimpor referensi OpenStreetMap." }

Write-Host "Impor selesai. CSV audit lokal: $csvPath"
} finally {
  $importLockStream.Dispose()
}
