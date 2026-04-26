"use client";

import { useRef, useState } from "react";

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("No file selected");
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState("");

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);

  const openPicker = () => {
    fileInputRef.current?.click();
  };

  // Upload PDF
  const handleFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setUploading(true);

    setSummary("");
    setQuestion("");
    setAnswer("");
    setSources([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:8000/summary", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setSummary(data.summary);
    } catch {
      setSummary("Failed to generate summary.");
    } finally {
      setUploading(false);
    }
  };

  // Ask Question
  const askQuestion = async () => {
    if (!question.trim()) return;

    setAsking(true);
    setAnswer("");
    setSources([]);

    try {
      const res = await fetch("http://127.0.0.1:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: question
        })
      });

      const data = await res.json();

      setAnswer(data.answer);
      setSources(data.sources || []);
    } catch {
      setAnswer("Failed to get answer.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#06070A] text-white px-6 py-10">

      {/* Hidden Input */}
      <input
        type="file"
        accept=".pdf"
        ref={fileInputRef}
        onChange={handleFile}
        className="hidden"
      />

      {/* Navbar */}
      <nav className="max-w-7xl mx-auto flex justify-between items-center mb-16">
        <h1 className="text-3xl font-bold tracking-tight">
          DocuMind
        </h1>

        <button className="px-5 py-2 rounded-xl bg-white text-black font-medium">
          Dashboard
        </button>
      </nav>

      {/* Main Grid */}
      <section className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 items-start">

        {/* Left Side */}
        <div>
          <p className="text-violet-400 font-medium mb-4">
            AI Powered PDF Intelligence
          </p>

          <h1 className="text-6xl font-bold leading-tight mb-6">
            Turn Documents Into Insights
          </h1>

          <p className="text-zinc-400 text-lg mb-8 max-w-xl leading-relaxed">
            Upload PDFs, generate summaries, and ask smart questions instantly.
          </p>

          <button
            onClick={openPicker}
            className="px-7 py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-lg font-semibold transition"
          >
            {uploading ? "Processing..." : "Upload PDF"}
          </button>

          <p className="mt-4 text-sm text-zinc-500">
            {fileName}
          </p>
        </div>

        {/* Right Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 min-h-[700px] shadow-2xl">

          <h2 className="text-2xl font-semibold mb-6">
            AI Workspace
          </h2>

          {/* Summary */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3 text-violet-300">
              Summary
            </h3>

            {uploading ? (
              <p className="text-zinc-400 animate-pulse">
                Generating summary...
              </p>
            ) : summary ? (
              <div className="text-zinc-300 leading-8 whitespace-pre-line text-[15px]">
                {summary}
              </div>
            ) : (
              <p className="text-zinc-500">
                Upload a PDF to generate summary.
              </p>
            )}
          </div>

          {/* Ask Section */}
          <div className="border-t border-white/10 pt-6">

            <h3 className="text-lg font-semibold mb-3 text-violet-300">
              Ask About This Document
            </h3>

            <input
              type="text"
              placeholder="Ask a question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 outline-none mb-4"
            />

            <button
              onClick={askQuestion}
              className="px-5 py-3 rounded-xl bg-white text-black font-medium hover:scale-105 transition"
            >
              {asking ? "Thinking..." : "Ask"}
            </button>

            {/* Answer */}
            <div className="mt-6">
              {asking ? (
                <p className="text-zinc-400 animate-pulse">
                  Finding answer...
                </p>
              ) : answer ? (
                <>
                  <div className="text-zinc-300 leading-8 whitespace-pre-line mb-5">
                    {answer}
                  </div>

                  {/* Sources */}
                  {sources.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-violet-300 mb-3">
                        Sources
                      </h4>

                      <div className="flex flex-wrap gap-2">
                        {sources.map((source, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 rounded-full bg-violet-600/20 text-violet-200 text-sm border border-violet-500/20"
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-zinc-500">
                  Your answer will appear here.
                </p>
              )}
            </div>

          </div>

        </div>

      </section>
    </main>
  );
}