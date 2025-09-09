import { describe, it, expect } from "vitest";
import { commandRegistry } from "./registry.js";
import "./builtins.js"; // Import to trigger registration

describe("Built-in Commands Registration", () => {
  it("should have commands registered when module loads", () => {
    const all = commandRegistry.getAll();
    console.log("All registered commands:", all.map(c => c.name));
    
    expect(all.length).toBeGreaterThan(0);
    expect(all.map(c => c.name)).toContain("clear");
    expect(all.map(c => c.name)).toContain("help");
    expect(all.map(c => c.name)).toContain("exit");
  });

  it("should return suggestions for '/' input", () => {
    const suggestions = commandRegistry.getSuggestions("/");
    console.log("Suggestions for '/':", suggestions.map(s => s.name));
    
    expect(suggestions.length).toBe(3);
    expect(suggestions.map(s => s.name)).toContain("clear");
    expect(suggestions.map(s => s.name)).toContain("help");
    expect(suggestions.map(s => s.name)).toContain("exit");
  });

  it("should return filtered suggestions for partial input", () => {
    const suggestions = commandRegistry.getSuggestions("/cl");
    console.log("Suggestions for '/cl':", suggestions.map(s => s.name));
    
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].name).toBe("clear");
  });

  it("help command should work and return text", () => {
    const result = commandRegistry.execute("/help");
    
    expect(result.isCommand).toBe(true);
    expect(result.result).toBeDefined();
    expect(result.result).toContain("Available commands:");
    expect(result.result).toContain("/clear");
    expect(result.result).toContain("/help");
    expect(result.result).toContain("/exit");
    
    console.log("Help output:\n", result.result);
  });

  it("clear command should work but return undefined", () => {
    const result = commandRegistry.execute("/clear");
    
    expect(result.isCommand).toBe(true);
    expect(result.result).toBeUndefined();
  });
});