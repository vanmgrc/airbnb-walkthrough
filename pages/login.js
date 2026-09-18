import { useState } from "react";
import { useRouter } from "next/router";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/");
    } else {
      setError("Wrong password.");
    }
  }

  return (
    <div className="login-wrap">
      <form onSubmit={handleSubmit} className="login-card">
        <h1>Walkthrough Prompt Tool</h1>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <button type="submit">Enter</button>
        {error && <p className="error">{error}</p>}
      </form>
      <style jsx>{`
        .login-wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #16181d;
        }
        .login-card {
          background: #1f222a;
          padding: 2.5rem;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          width: 280px;
        }
        h1 {
          font-size: 1.1rem;
          color: #f2f0ea;
          margin: 0 0 0.5rem 0;
        }
        input {
          padding: 0.7rem 0.8rem;
          border-radius: 8px;
          border: 1px solid #33373f;
          background: #14161b;
          color: #f2f0ea;
          font-size: 0.95rem;
        }
        button {
          padding: 0.7rem;
          border-radius: 8px;
          border: none;
          background: #ff6f59;
          color: #14161b;
          font-weight: 600;
          cursor: pointer;
        }
        .error {
          color: #ff8a80;
          font-size: 0.85rem;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
