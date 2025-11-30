"""
Usage
-----
python infer_qwen_rhetorical_questions.py \
       --head models/rq_head_qwen_0_6.joblib \
       --sent "Where did the plane land?"
"""
import argparse, joblib
from sentence_transformers import SentenceTransformer
import os

EMBED_MODEL = "Qwen/Qwen3-Embedding-0.6B"   # same model used at training time
HEAD = "models/rq_head_qwen_0_6.joblib" # can be overridden by cli argument
ID2LABEL = {0: "non_rhetorical", 1: "rhetorical"}

qwen = None
clf = None

def load_model():
    global qwen, clf, HEAD, EMBED_MODEL
    print("⏳ Loading embedding model and classifier …", flush=True)
    qwen = SentenceTransformer(
        EMBED_MODEL,
        trust_remote_code=True  # required for all Qwen3 models
        # Device picks itself (mps on Apple Silicon, cpu otherwise).
    )

    head_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), HEAD)
    clf    = joblib.load(head_path)
    return qwen, clf

def run_inference(sentence):
    emb    = qwen.encode([sentence], convert_to_tensor=False)  # → (1, 2560)
    pred   = clf.predict(emb)[0]
    prob   = clf.predict_proba(emb)[0, pred]
    label  = ID2LABEL[pred]
    return label, prob

def main(args):
    global HEAD
    if args.head:
        HEAD = args.head
    
    load_model()

    label, prob = run_inference(args.sent)

    print(f"➜  {args.sent}\n   ⇒ {label}  (p={prob:.2%})")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--head", required=True, help="Path to trained .joblib head")
    ap.add_argument("--sent", required=True, help="Sentence to classify")
    main(ap.parse_args())