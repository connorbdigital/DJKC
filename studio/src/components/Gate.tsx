import { useState, type FormEvent } from "react";

export function Gate({ onSubmit, error }: { onSubmit: (token: string) => void; error: string }) {
  const [value, setValue] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim().length < 10) return;
    onSubmit(value.trim());
  };

  return (
    <div className="gate">
      <div className="panel">
        <p className="eyebrow">Studio access</p>
        <h1>Paste a GitHub token</h1>
        <p className="muted">
          A fine-grained token with read access to your repositories is enough to browse. For the feature installer and the
          agent's pull requests, give it <strong>Contents</strong> and <strong>Pull requests: read and write</strong>.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="token">Token</label>
          <input
            id="token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="github_pat_…"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <button className="btn primary" type="submit">Unlock</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="muted small">
          Kept in this tab's sessionStorage — not a cookie, not local storage, gone when you close the tab. Create one at
          GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens.
        </p>
      </div>
    </div>
  );
}
