#!/usr/bin/env python3
"""
Script untuk fine-tuning model Lajukan dengan dataset sendiri.
Menggunakan Unsloth untuk fine-tuning yang cepat dan efisien.

Install dependencies:
pip install unsloth transformers datasets trl peft accelerate bitsandbytes

Usage:
python scripts/fine-tune-lajukan.py --dataset lajukan_dataset.jsonl --output lajukan-finetuned
"""

import argparse
import json
from pathlib import Path
from unsloth import FastLanguageModel
from datasets import Dataset
from trl import SFTTrainer
from transformers import TrainingArguments
import torch

def load_dataset_from_jsonl(file_path: str):
    """Load dataset dari JSONL file"""
    data = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                data.append(json.loads(line))
    
    # Convert ke format yang dibutuhkan
    texts = []
    for item in data:
        instruction = item.get('instruction', '')
        input_text = item.get('input', '')
        output = item.get('output', '')
        
        # Format untuk chat model
        if input_text:
            text = f"### Instruction:\n{instruction}\n\n### Input:\n{input_text}\n\n### Response:\n{output}"
        else:
            text = f"### Instruction:\n{instruction}\n\n### Response:\n{output}"
        
        texts.append(text)
    
    return Dataset.from_dict({'text': texts})

def main():
    parser = argparse.ArgumentParser(description='Fine-tune Lajukan AI model')
    parser.add_argument('--dataset', type=str, required=True, help='Path to JSONL dataset file')
    parser.add_argument('--output', type=str, default='lajukan-finetuned', help='Output directory for fine-tuned model')
    parser.add_argument('--base-model', type=str, default='unsloth/llama-3.2-3b-bnb-4bit', help='Base model to fine-tune')
    parser.add_argument('--epochs', type=int, default=3, help='Number of training epochs')
    parser.add_argument('--batch-size', type=int, default=2, help='Training batch size')
    parser.add_argument('--learning-rate', type=float, default=2e-4, help='Learning rate')
    
    args = parser.parse_args()
    
    print("🚀 Starting fine-tuning for Lajukan AI...")
    print(f"📁 Dataset: {args.dataset}")
    print(f"💾 Output: {args.output}")
    print(f"🤖 Base model: {args.base_model}")
    
    # Load model
    print("\n📥 Loading model...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base_model,
        max_seq_length=2048,
        dtype=None,
        load_in_4bit=True,  # Quantization untuk menghemat memory
    )
    
    # Enable LoRA untuk efficient fine-tuning
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,  # Rank
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha=16,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing=True,
        random_state=3407,
    )
    
    # Load dataset
    print("\n📚 Loading dataset...")
    dataset = load_dataset_from_jsonl(args.dataset)
    print(f"✅ Loaded {len(dataset)} examples")
    
    # Training arguments
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=2048,
        packing=False,
        args=TrainingArguments(
            per_device_train_batch_size=args.batch_size,
            gradient_accumulation_steps=4,
            warmup_steps=5,
            num_train_epochs=args.epochs,
            learning_rate=args.learning_rate,
            fp16=not torch.cuda.is_bf16_supported(),
            bf16=torch.cuda.is_bf16_supported(),
            logging_steps=1,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="linear",
            seed=3407,
            output_dir=args.output,
            save_strategy="epoch",
        ),
    )
    
    # Train
    print("\n🏋️  Starting training...")
    trainer.train()
    
    # Save model
    print(f"\n💾 Saving model to {args.output}...")
    model.save_pretrained(args.output)
    tokenizer.save_pretrained(args.output)
    
    print("\n✅ Fine-tuning complete!")
    print(f"\n📝 Next steps:")
    print(f"   1. Convert model ke GGUF format untuk Ollama")
    print(f"   2. Atau gunakan dengan vLLM engine")
    print(f"   3. Test model dengan: ollama run {args.output}")

if __name__ == '__main__':
    main()
