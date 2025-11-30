# 1. Train
python train_qwen_voice_classifier.py \
       --tsv data/voice_pairs.tsv \
       --out_head models/voice_head.joblib \
       --csv data/voice_dataset.csv

# 2. Inference
python infer_qwen_voice_classifier.py \
       --head models/voice_head.joblib \
       --sent "In cases of dispute the matter shall be resolved by the judgement of the barons."

# With 1% random sampling we get the following from training:
✅  Held‑out accuracy: 0.727
# With 5% random sampling we get the following from training:
✅  Held‑out accuracy: 0.813

💾  Saved head to models/voice_head.joblib
# With 10% random sampling we get the following from training (0.6B qwen3):
✅  Held‑out accuracy: 0.814
# With 20% random sampling we get the following from training (0.6B qwen3):
✅  Held‑out accuracy: 0.821
# With 30% random sampling we get the following from training (0.6B qwen3):
✅  Held‑out accuracy: 0.825


# Example
In cases of dispute the matter shall be resolved by the judgement of the twenty-five barons referred to below in the clause for securing the peace.
   ⇒ passive  (p=55.05%)