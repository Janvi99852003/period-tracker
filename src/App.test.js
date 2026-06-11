// Mock Supabase BEFORE any imports
import { render, screen, waitFor } from "@testing-library/react";

// Mock recharts
jest.mock("recharts", () => ({
  LineChart: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  Line: () => null, Bar: () => null,
  XAxis: () => null, YAxis: () => null,
  Tooltip: () => null, CartesianGrid: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

// Mock supabase module
jest.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } }
      }),
      signInWithPassword: () => Promise.resolve({ data: {}, error: null }),
      signUp: () => Promise.resolve({ data: {}, error: null }),
      signOut: () => Promise.resolve({}),
    },
    from: () => ({
      select: function() { return this; },
      eq: function() { return this; },
      single: () => Promise.resolve({ data: null, error: { code: "PGRST116" } }),
      upsert: () => Promise.resolve({ error: null }),
      delete: function() { return this; },
    }),
  },
}));

import App from "./App";

beforeEach(() => {
  localStorage.clear();
});

test("renders without crashing", () => {
  render(<App />);
  expect(document.body).toBeInTheDocument();
});

test("shows splash screen initially", () => {
  render(<App />);
  expect(screen.getByText(/your cycle, your way/i)).toBeInTheDocument();
});

test("shows auth screen after splash", async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  }, { timeout: 4000 });
});

test("auth screen has email input", async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
  }, { timeout: 4000 });
});

test("auth screen has password input", async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
  }, { timeout: 4000 });
});

test("auth screen has sign in button", async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  }, { timeout: 4000 });
});

test("auth screen has sign up link", async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
  }, { timeout: 4000 });
});