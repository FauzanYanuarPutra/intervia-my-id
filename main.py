import requests
import time

url = "https://github.com/FauzanYanuarPutra"

for i in range(20000):
    print(f"Request ke-{i+1}")
    try:
        response = requests.get(url)
        print("Status:", response.status_code)
    except Exception as e:
        print("Error:", e)

    time.sleep(1)  # jeda 1 detik agar tidak terlalu cepat (optional)

print("Selesai!")
