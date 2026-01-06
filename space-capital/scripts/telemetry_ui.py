import os, tempfile, json
import streamlit as st
import pandas as pd
from telemetry_updater import summarize_csv

st.title("Space Capital — Telemetry Updater")
st.write("Upload TradingView 45-min CSVs → generate per-ticker summaries → write into repo.")

repo = st.text_input("Repo path (repo root OR /trading folder)", value="")
out_rel = st.text_input("Output folder (relative to trading/)", value="data/market_summaries")

uploads = st.file_uploader("Upload one or more CSV files", type=["csv"], accept_multiple_files=True)

if st.button("Generate summaries") and uploads:
    tmpdir = tempfile.mkdtemp()
    summaries = []
    for up in uploads:
        p = os.path.join(tmpdir, up.name)
        with open(p, "wb") as f:
            f.write(up.getbuffer())
        summaries.append(summarize_csv(p).to_dict())

    st.success(f"Generated {len(summaries)} summaries")
    st.json(summaries[:2])

    if repo and st.button("Write to repo"):
        repo_path = os.path.abspath(repo)
        if os.path.basename(repo_path) == "trading":
            trading_root = repo_path
        else:
            trading_root = os.path.join(repo_path, "trading")

        out_dir = os.path.join(trading_root, out_rel)
        os.makedirs(out_dir, exist_ok=True)

        for s in summaries:
            out_path = os.path.join(out_dir, f"{s['ticker']}.json")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(s, f, indent=2)
        st.success(f"Wrote {len(summaries)} files to {out_dir}")
