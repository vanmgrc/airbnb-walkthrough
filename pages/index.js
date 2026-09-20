import { useEffect, useState } from "react";

// History entries saved before photos carried room labels stored bare URL
// strings, so anything coming back from the server is normalized here.
function normalizePhotos(list) {
  return (list || []).map((p) => (typeof p === "string" ? { url: p, room: "" } : p));
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [photos, setPhotos] = useState([]);
  const [selected, setSelected] = useState([]);
  const [notes, setNotes] = useState("");
  const [instructions, setInstructions] = useState("");
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
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    loadHistory();
  }, []);

  // History is a convenience, not core to generating a prompt, so a database
  // that isn't set up yet surfaces inside the history panel instead of
  // blocking the rest of the page.
  async function loadHistory() {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (res.ok) {
        setHistory(data.entries || []);
        setHistoryError("");
      } else {
        setHistoryError(data.error || "Couldn't load history.");
      }
    } catch (e) {
      setHistoryError("Couldn't load history.");
    }
  }

  async function saveToHistory(promptText, provider) {
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingUrl: url,
          provider,
          prompt: promptText,
          photos,
          selected,
          settings: { aspectRatio, duration, includeTitle, titleText, notes, instructions },
        }),
      });
      if (res.ok) {
        loadHistory();
      } else {
        const data = await res.json().catch(() => ({}));
        setHistoryError(data.error || "Couldn't save this run to history.");
      }
    } catch (e) {
      setHistoryError("Couldn't save this run to history.");
    }
  }

  async function deleteEntry(id) {
    try {
      await fetch(`/api/history?id=${id}`, { method: "DELETE" });
      loadHistory();
    } catch (e) {
      setHistoryError("Couldn't delete that entry.");
    }
  }

  // Puts the page back exactly where it was for a past run: same photos, same
  // selection, same settings, same prompt.
  function loadEntry(entry) {
    const settings = entry.settings || {};
    setUrl(entry.listing_url || "");
    setPhotos(normalizePhotos(entry.photos));
    setSelected(entry.selected || []);
    setPrompt(entry.prompt || "");
    setUsedProvider(entry.provider || "");
    setAspectRatio(settings.aspectRatio || "9:16");
    setDuration(settings.duration || 30);
    setIncludeTitle(Boolean(settings.includeTitle));
    setTitleText(settings.titleText || "");
    setNotes(settings.notes || "");
    setInstructions(settings.instructions || "");
    setProvider(entry.provider || "claude");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
        setPhotos(normalizePhotos(data.photos));
        setSelected([]);
      }
    } catch (e) {
      setError("Failed to reach the server.");
    }
    setLoadingPhotos(false);
  }

  // Selection order is the shot order, so picking a photo appends it rather
  // than flipping a flag. Dropping one renumbers everything after it.
  function toggle(url) {
    setSelected((current) =>
      current.includes(url) ? current.filter((u) => u !== url) : [...current, url]
    );
  }

  function selectAll() {
    setSelected(photos.map((photo) => photo.url));
  }

  // Selected URLs paired back up with their room labels, in selection order.
  function selectedPhotos() {
    return selected.map(
      (url) => photos.find((photo) => photo.url === url) || { url, room: "" }
    );
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
          photos: selectedPhotos(),
          notes,
          instructions,
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
        saveToHistory(data.prompt, data.provider);
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
      const list = selected;
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
            <p>
              {selected.length > 0
                ? `${selected.length} of ${photos.length} selected, numbered in the order you picked them.`
                : `${photos.length} photos. Click them in the order you want them to appear.`}
            </p>
            <div className="header-actions">
              <button className="ghost-btn" onClick={selectAll} disabled={zipping}>
                Select all
              </button>
              <button
                className="ghost-btn"
                onClick={() => setSelected([])}
                disabled={selected.length === 0 || zipping}
              >
                Clear
              </button>
              <button
                className="download-btn"
                onClick={downloadPhotos}
                disabled={selected.length === 0 || zipping}
              >
                {zipping ? `Zipping ${zipDone}/${selected.length}…` : "Download as zip"}
              </button>
            </div>
          </section>
          <section className="grid">
            {photos.map((photo) => {
              const position = selected.indexOf(photo.url);
              return (
                <button
                  key={photo.url}
                  type="button"
                  className={`tile ${position > -1 ? "on" : "off"}`}
                  onClick={() => toggle(photo.url)}
                >
                  <img src={photo.url} alt={photo.room} loading="lazy" />
                  {position > -1 && <span className="order">{position + 1}</span>}
                </button>
              );
            })}
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
            <div className="note-field">
              <label>Notes about this listing (optional)</label>
              <textarea
                placeholder="What to feature or leave out, e.g. highlight the pool, skip the bathroom shots…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="note-field">
              <label>How to write the prompt (optional)</label>
              <textarea
                placeholder="Direction for the writing itself, e.g. keep it under 150 words, use cinematic language, always open on the exterior…"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>
          </section>

          <button
            className="generate-btn"
            onClick={generatePrompt}
            disabled={selected.length === 0 || loadingPrompt}
          >
            {loadingPrompt ? "Writing prompt…" : `Generate prompt from ${selected.length} photos`}
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

      {(history.length > 0 || historyError) && (
        <section className="history">
          <h2>Recent listings</h2>
          {historyError && <p className="history-note">{historyError}</p>}
          {history.map((entry) => (
            <div key={entry.id} className="history-row">
              <div className="history-meta">
                <span className="history-date">
                  {new Date(entry.created_at).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <span className="provider-tag">
                  {entry.provider === "chatgpt" ? "ChatGPT" : "Claude"}
                </span>
                <span className="history-count">
                  {(entry.selected || []).length} photos
                </span>
              </div>
              <div className="history-url" title={entry.listing_url}>
                {entry.listing_url || "No listing URL"}
              </div>
              <div className="history-actions">
                <button className="ghost-btn" onClick={() => loadEntry(entry)}>
                  Load
                </button>
                <button className="ghost-btn" onClick={() => deleteEntry(entry.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
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
        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-shrink: 0;
        }
        .tile {
          position: relative;
          aspect-ratio: 1;
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid transparent;
          display: block;
          width: 100%;
          padding: 0;
          background: #1f222a;
        }
        .tile.on {
          border-color: #ff6f59;
        }
        .tile.off img {
          opacity: 0.7;
        }
        .tile img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .tile .order {
          position: absolute;
          top: 6px;
          right: 6px;
          min-width: 22px;
          height: 22px;
          padding: 0 5px;
          border-radius: 11px;
          background: #ff6f59;
          color: #14161b;
          font-size: 0.75rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
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
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
        }
        .note-field label {
          display: block;
          font-size: 0.85rem;
          color: #9a9a9a;
          margin-bottom: 0.4rem;
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
        .history {
          margin-top: 2rem;
        }
        .history h2 {
          font-size: 1rem;
          margin: 0 0 0.7rem 0;
        }
        .history-note {
          color: #9a9a9a;
          font-size: 0.85rem;
          margin: 0 0 0.7rem;
        }
        .history-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          background: #1f222a;
          border-radius: 10px;
          padding: 0.8rem 1rem;
          margin-bottom: 0.5rem;
        }
        .history-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }
        .history-date,
        .history-count {
          color: #9a9a9a;
          font-size: 0.8rem;
          white-space: nowrap;
        }
        .history-url {
          flex: 1;
          min-width: 140px;
          color: #f2f0ea;
          font-size: 0.8rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .history-actions {
          display: flex;
          gap: 0.4rem;
          flex-shrink: 0;
        }
        .ghost-btn {
          padding: 0.35rem 0.7rem;
          border-radius: 6px;
          border: 1px solid #33373f;
          background: transparent;
          color: #f2f0ea;
          font-size: 0.78rem;
          font-weight: 500;
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
