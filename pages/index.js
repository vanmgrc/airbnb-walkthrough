import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [photos, setPhotos] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [notes, setNotes] = useState("");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [duration, setDuration] = useState(30);
  const [includeTitle, setIncludeTitle] = useState(false);
  const [titleText, setTitleText] = useState("");
  const [provider, setProvider] = useState("claude");
  const [usedProvider, setUsedProvider] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [zipDone, setZipDone] = useState(0);
  const [copied, setCopied] = useState(false);

  async function fetchPhotos() {
    setError("");
    setPrompt("");
    setPhotos([]);
    setLoadingPhotos(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setPhotos(data.photos);
        setSelected(new Set(data.photos));
      }
    } catch (e) {
      setError("Failed to reach the server.");
    }
    setLoadingPhotos(false);
  }

  function toggle(photo) {
    const next = new Set(selected);
    if (next.has(photo)) next.delete(photo);
    else next.add(photo);
    setSelected(next);
  }

  async function generatePrompt() {
    setError("");
    setPrompt("");
    setUsedProvider("");
    setLoadingPrompt(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: Array.from(selected),
          notes,
          aspectRatio,
          duration,
          includeTitle,
          titleText,
          provider,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setPrompt(data.prompt);
        setUsedProvider(data.provider);
      }
    } catch (e) {
      setError("Failed to reach the server.");
    }
    setLoadingPrompt(false);
  }

  // Builds the zip in the browser rather than on the server: a full 60-photo
  // listing runs well past what a serverless response can return in one go.
  async function downloadPhotos() {
    setError("");
    setZipDone(0);
    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const list = Array.from(selected);
      let added = 0;

      for (let i = 0; i < list.length; i++) {
        const res = await fetch(`/api/photo?url=${encodeURIComponent(list[i])}`);
        if (res.ok) {
          const blob = await res.blob();
          const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
          zip.file(`photo-${String(i + 1).padStart(2, "0")}.${ext}`, blob);
          added++;
        }
        setZipDone(i + 1);
      }

      if (added === 0) {
        setError("Couldn't download any of the selected photos.");
      } else {
        const content = await zip.generateAsync({ type: "blob" });
        const href = URL.createObjectURL(content);
        const link = document.createElement("a");
        link.href = href;
        link.download = "listing-photos.zip";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
      }
    } catch (e) {
      setError("Failed to build the zip file.");
    }
    setZipping(false);
  }

  function copyPrompt() {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="page">
      <header>
        <h1>Airbnb walkthrough prompt</h1>
        <p className="sub">Paste a listing, pick the right photos, get a Higgsfield-ready prompt.</p>
      </header>

      <section className="url-row">
        <input
          type="text"
          placeholder="https://www.airbnb.com/rooms/12345678"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button onClick={fetchPhotos} disabled={!url || loadingPhotos}>
          {loadingPhotos ? "Fetching…" : "Fetch photos"}
        </button>
      </section>

      {error && <p className="error">{error}</p>}

      {photos.length > 0 && (
        <>
          <section className="grid-header">
            <p>{selected.size} of {photos.length} selected. Uncheck anything that isn't part of the unit.</p>
            <button
              className="download-btn"
              onClick={downloadPhotos}
              disabled={selected.size === 0 || zipping}
            >
              {zipping ? `Zipping ${zipDone}/${selected.size}…` : "Download as zip"}
            </button>
          </section>
          <section className="grid">
            {photos.map((photo) => (
              <label key={photo} className={`tile ${selected.has(photo) ? "on" : "off"}`}>
                <img src={photo} alt="" loading="lazy" />
                <input
                  type="checkbox"
                  checked={selected.has(photo)}
                  onChange={() => toggle(photo)}
                />
              </label>
            ))}
          </section>

          <section className="settings">
            <div className="setting">
              <label>Write the prompt with</label>
              <div className="toggle-group">
                <button
                  type="button"
                  className={provider === "claude" ? "chip on" : "chip"}
                  onClick={() => setProvider("claude")}
                >
                  Claude
                </button>
                <button
                  type="button"
                  className={provider === "chatgpt" ? "chip on" : "chip"}
                  onClick={() => setProvider("chatgpt")}
                >
                  ChatGPT
                </button>
              </div>
            </div>

            <div className="setting">
              <label>Aspect ratio</label>
              <div className="toggle-group">
                <button
                  type="button"
                  className={aspectRatio === "9:16" ? "chip on" : "chip"}
                  onClick={() => setAspectRatio("9:16")}
                >
                  9:16 vertical
                </button>
                <button
                  type="button"
                  className={aspectRatio === "16:9" ? "chip on" : "chip"}
                  onClick={() => setAspectRatio("16:9")}
                >
                  16:9 horizontal
                </button>
              </div>
            </div>

            <div className="setting">
              <label>Duration</label>
              <div className="duration-row">
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
                <span>{duration}s</span>
              </div>
            </div>

            <div className="setting">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includeTitle}
                  onChange={(e) => setIncludeTitle(e.target.checked)}
                />
                Open with a title card
              </label>
              {includeTitle && (
                <input
                  type="text"
                  className="title-input"
                  placeholder="Title text, e.g. property name or headline"
                  value={titleText}
                  onChange={(e) => setTitleText(e.target.value)}
                />
              )}
            </div>
          </section>

          <section className="notes-row">
            <textarea
              placeholder="Optional notes for Claude (e.g. highlight the pool, skip the bathroom shots)…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </section>

          <button
            className="generate-btn"
            onClick={generatePrompt}
            disabled={selected.size === 0 || loadingPrompt}
          >
            {loadingPrompt ? "Writing prompt…" : `Generate prompt from ${selected.size} photos`}
          </button>
        </>
      )}

      {prompt && (
        <section className="output">
          <div className="output-head">
            <div className="output-title">
              <h2>Your Higgsfield prompt</h2>
              {usedProvider && (
                <span className="provider-tag">
                  {usedProvider === "chatgpt" ? "ChatGPT" : "Claude"}
                </span>
              )}
            </div>
            <button onClick={copyPrompt}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <pre>{prompt}</pre>
        </section>
      )}

      <style jsx>{`
        .page {
          max-width: 760px;
          margin: 0 auto;
          padding: 3rem 1.5rem 5rem;
        }
        header {
          margin-bottom: 2rem;
        }
        h1 {
          font-size: 1.6rem;
          margin: 0 0 0.4rem 0;
        }
        .sub {
          color: #9a9a9a;
          margin: 0;
        }
        .url-row {
          display: flex;
          gap: 0.6rem;
        }
        input[type="text"] {
          flex: 1;
          padding: 0.75rem 0.9rem;
          border-radius: 8px;
          border: 1px solid #33373f;
          background: #1f222a;
          color: #f2f0ea;
          font-size: 0.95rem;
        }
        button {
          padding: 0.75rem 1.1rem;
          border-radius: 8px;
          border: none;
          background: #ff6f59;
          color: #14161b;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.9rem;
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .error {
          color: #ff8a80;
          margin-top: 1rem;
        }
        .grid-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .grid-header p {
          color: #9a9a9a;
          font-size: 0.9rem;
          margin: 1.5rem 0 0.7rem;
        }
        .download-btn {
          flex-shrink: 0;
          padding: 0.45rem 0.85rem;
          border-radius: 8px;
          border: 1px solid #33373f;
          background: transparent;
          color: #f2f0ea;
          font-size: 0.8rem;
          font-weight: 500;
          white-space: nowrap;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 0.5rem;
        }
        .tile {
          position: relative;
          aspect-ratio: 1;
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid transparent;
        }
        .tile.on {
          border-color: #ff6f59;
        }
        .tile.off img {
          opacity: 0.3;
        }
        .tile img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .tile input {
          position: absolute;
          top: 6px;
          right: 6px;
        }
        .settings {
          margin-top: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
          background: #1f222a;
          border-radius: 10px;
          padding: 1.1rem 1.3rem;
        }
        .setting label {
          display: block;
          font-size: 0.85rem;
          color: #9a9a9a;
          margin-bottom: 0.5rem;
        }
        .toggle-group {
          display: flex;
          gap: 0.5rem;
        }
        .chip {
          padding: 0.5rem 0.9rem;
          border-radius: 20px;
          border: 1px solid #33373f;
          background: transparent;
          color: #f2f0ea;
          font-size: 0.85rem;
          font-weight: 400;
          cursor: pointer;
        }
        .chip.on {
          background: #ff6f59;
          border-color: #ff6f59;
          color: #14161b;
          font-weight: 600;
        }
        .duration-row {
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }
        .duration-row input[type="range"] {
          flex: 1;
        }
        .duration-row span {
          font-size: 0.85rem;
          color: #f2f0ea;
          min-width: 34px;
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0;
          color: #f2f0ea;
          font-size: 0.9rem;
          cursor: pointer;
        }
        .title-input {
          margin-top: 0.6rem;
          width: 100%;
          padding: 0.6rem 0.8rem;
          border-radius: 8px;
          border: 1px solid #33373f;
          background: #14161b;
          color: #f2f0ea;
          font-size: 0.9rem;
        }
        .notes-row {
          margin-top: 1.2rem;
        }
        textarea {
          width: 100%;
          min-height: 70px;
          padding: 0.75rem 0.9rem;
          border-radius: 8px;
          border: 1px solid #33373f;
          background: #1f222a;
          color: #f2f0ea;
          font-size: 0.9rem;
          font-family: inherit;
          resize: vertical;
        }
        .generate-btn {
          margin-top: 1rem;
          width: 100%;
        }
        .output {
          margin-top: 2rem;
          background: #1f222a;
          border-radius: 10px;
          padding: 1.2rem 1.4rem;
        }
        .output-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.6rem;
        }
        .output-head h2 {
          font-size: 1rem;
          margin: 0;
        }
        .output-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .provider-tag {
          padding: 0.15rem 0.5rem;
          border-radius: 20px;
          background: #33373f;
          color: #cfcac0;
          font-size: 0.7rem;
          font-weight: 600;
        }
        pre {
          white-space: pre-wrap;
          font-family: inherit;
          font-size: 0.9rem;
          line-height: 1.5;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
