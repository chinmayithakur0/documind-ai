from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader
from dotenv import load_dotenv

import chromadb
from sentence_transformers import SentenceTransformer

import requests
import shutil
import os
import re

# ------------------------
# Load ENV
# ------------------------
load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# ------------------------
# FastAPI
# ------------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------
# Storage
# ------------------------
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ------------------------
# Chroma Setup
# ------------------------
client = chromadb.Client()
collection = client.get_or_create_collection("documents")

embed_model = SentenceTransformer("all-MiniLM-L6-v2")

# ------------------------
# Utility
# ------------------------
def clean_text(text):
    text = text.replace("\n", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def chunk_text(text, chunk_size=500):
    words = text.split()
    chunks = []

    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)

    return chunks

# ------------------------
# Request Model
# ------------------------
class QuestionRequest(BaseModel):
    question: str

# ------------------------
# Home Route
# ------------------------
@app.get("/")
def home():
    return {"message": "Backend running successfully"}

# ------------------------
# Summary Route
# ------------------------
@app.post("/summary")
def generate_summary(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)

        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Read PDF
        reader = PdfReader(file_path)

        text = ""
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + " "

        text = clean_text(text)

        if not text:
            return {"summary": "No readable text found."}

        # ------------------------
        # Reset Chroma Collection
        # ------------------------
        try:
            collection.delete(where={})
        except:
            pass

        # ------------------------
        # Store Chunks in Chroma
        # ------------------------
        chunks = chunk_text(text)

        for i, chunk in enumerate(chunks):
            embedding = embed_model.encode(chunk).tolist()

            collection.add(
                ids=[str(i)],
                documents=[chunk],
                embeddings=[embedding]
            )

        # ------------------------
        # Generate Summary
        # ------------------------
        short_text = text[:3500]

        prompt = f"""
You are an expert document analyst.

Summarize the following document in professional bullet points.

Return:
• Main topic
• Key insights
• Important facts
• Final takeaway

Document:
{short_text}
"""

        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "openai/gpt-3.5-turbo",
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
        )

        data = response.json()
        summary = data["choices"][0]["message"]["content"]

        return {
            "summary": summary
        }

    except Exception as e:
        return {
            "summary": str(e)
        }

# ------------------------
# Ask Route with Citations
# ------------------------
@app.post("/ask")
def ask_question(payload: QuestionRequest):
    try:
        question = payload.question

        query_embedding = embed_model.encode(question).tolist()

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=3
        )

        docs = results["documents"][0]
        ids = results["ids"][0]

        context = "\n\n".join(docs)

        prompt = f"""
Use ONLY the context below to answer clearly and professionally.

Context:
{context}

Question:
{question}
"""

        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "openai/gpt-3.5-turbo",
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
        )

        data = response.json()
        answer = data["choices"][0]["message"]["content"]

        sources = [f"Chunk {chunk_id}" for chunk_id in ids]

        return {
            "answer": answer,
            "sources": sources
        }

    except Exception as e:
        return {
            "answer": str(e)
        }