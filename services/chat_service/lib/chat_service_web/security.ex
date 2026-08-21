defmodule ChatService.Security do
  @forbidden_patterns [
    ~r/(?i)password/,
    ~r/(?i)transfer.*money/,
    # Unsafe links
    ~r/http:\/\/[^\s]+/
  ]

  def scan_content(body) do
    cond do
      is_binary(body) and String.length(body) > 5000 ->
        %{action: :block, reason: "payload_too_large"}

      Enum.any?(@forbidden_patterns, &Regex.run(&1, body)) ->
        %{action: :block, reason: "security_violation"}

      true ->
        %{action: :allow}
    end
  end
end
