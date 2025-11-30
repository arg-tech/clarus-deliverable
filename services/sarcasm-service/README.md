python train_qwen_binary_classifier.py \
  --csv data/rhetorical_questions.csv \
  --label_col is_rq \
  --out_head models/rq_head.joblib \
  --frac 1.0


✅  Report (test):
              precision    recall  f1-score   support

           0      0.916     1.000     0.956        76
           1      1.000     0.720     0.837        25

    accuracy                          0.931       101
   macro avg      0.958     0.860     0.897       101
weighted avg      0.937     0.931     0.927       101

💾  Saved head to models/rq_head.joblib


python train_qwen_binary_classifier.py \
  --csv data/sarcasm.csv \
  --label_col is_sarcastic \
  --out_head models/sarcasm_head.joblib \
  --max_words 123 \
  --batch_size 8 \ 
  --frac 0.1

✅  Report (test):
              precision    recall  f1-score   support

           0      0.627     0.636     0.631      3915
           1      0.630     0.621     0.626      3910

    accuracy                          0.628      7825
   macro avg      0.629     0.628     0.628      7825
weighted avg      0.629     0.628     0.628      7825

💾  Saved head to models/sarcasm_head.joblib
