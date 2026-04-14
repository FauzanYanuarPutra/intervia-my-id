#!/bin/bash

# Quick setup script untuk Ollama di Lajukan

echo "🚀 Setting up Ollama for Lajukan..."

# Check if Ollama container is running
if ! docker ps | grep -q laju_ollama; then
    echo "❌ Ollama container tidak berjalan. Start dengan: docker compose up -d ollama"
    exit 1
fi

echo "✅ Ollama container is running"

# Download base model jika belum ada
echo "📥 Checking for llama3.2:3b model..."
if docker exec laju_ollama ollama list | grep -q "llama3.2:3b"; then
    echo "✅ Model llama3.2:3b sudah ada"
else
    echo "📥 Downloading llama3.2:3b (ini mungkin butuh beberapa menit)..."
    docker exec laju_ollama ollama pull llama3.2:3b
fi

# Create custom model dari Modelfile
echo "🔧 Creating custom Lajukan AI model..."
if docker exec laju_ollama ollama list | grep -q "lajukan-ai"; then
    echo "✅ Custom model 'lajukan-ai' sudah ada"
else
    if [ -f "./models/ollama/Modelfile" ]; then
        docker exec -i laju_ollama ollama create lajukan-ai -f - < ./models/ollama/Modelfile
        echo "✅ Custom model 'lajukan-ai' created!"
    else
        echo "⚠️  Modelfile not found, creating default model..."
        docker exec laju_ollama sh -c 'ollama create lajukan-ai -f - <<EOF
FROM llama3.2:3b
SYSTEM "Kamu adalah AI assistant untuk Lajukan platform."
PARAMETER temperature 0.7
PARAMETER num_predict 500
EOF'
    fi
fi

# Test the model
echo "🧪 Testing custom model..."
docker exec laju_ollama ollama run lajukan-ai "Apa itu Lajukan?" --verbose

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Pastikan di .env.development sudah ada:"
echo "   USE_OLLAMA=true"
echo "   OLLAMA_URL=http://ollama:11434"
echo "   OLLAMA_MODEL=lajukan-ai"
echo ""
echo "💡 Restart www container setelah setup:"
echo "   docker compose restart www"
