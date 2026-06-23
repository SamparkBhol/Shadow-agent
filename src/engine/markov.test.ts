import { describe, it, expect } from "vitest";
import { MarkovModel } from "./markov";

describe("MarkovModel", () => {
  it("predicts the most frequent follower", () => {
    const m = new MarkovModel();
    m.learn(["git add", "git commit", "git push"]);
    m.learn(["git add", "git commit", "git push"]);
    const out = m.predict(["git add"], 3);
    expect(out[0]!.command).toBe("git commit");
    expect(out[0]!.source).toBe("sequence");
    expect(out[0]!.confidence).toBeGreaterThan(0);
  });

  it("backs off to lower-order n-grams when higher-order is unseen", () => {
    const m = new MarkovModel();
    m.learn(["a", "b", "c"]);
    const out = m.predict(["x", "b"], 3); // (x,b) unseen -> back off to (b)
    expect(out.map((s) => s.command)).toContain("c");
  });

  it("serializes and reloads losslessly", () => {
    const m = new MarkovModel();
    m.learn(["npm install", "npm run dev"]);
    const reloaded = MarkovModel.load(m.serialize());
    expect(reloaded.predict(["npm install"], 1)[0]!.command).toBe("npm run dev");
  });

  it("reweight(accepted=false) lowers a command's rank", () => {
    const m = new MarkovModel();
    m.learn(["build", "test"]);
    m.learn(["build", "deploy"]);
    m.reweight("test", false);
    const out = m.predict(["build"], 2);
    expect(out[0]!.command).toBe("deploy");
  });
});
