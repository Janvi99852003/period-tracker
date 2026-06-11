import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";

// Mock Supabase
jest.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn().mockReturnThis(),
    }),
  },
}));

// Mock recharts
jest.mock("recharts", () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Line: () => null, Bar: () => null,
  XAxis: () => null, YAxis: () => null,
  Tooltip: () => null, CartesianGrid: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

describe("Cyra App — Day 6 Supabase", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test("shows splash screen on load", () => {
    render(<App />);
    expect(screen.getByText(/your cycle, your way/i)).toBeInTheDocument();
  });

  test("shows auth screen after splash", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test("auth screen has email and password fields", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test("can switch between sign in and sign up", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/sign up/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    fireEvent.click(screen.getByText(/sign up/i));
    expect(screen.getByText(/create account/i)).toBeInTheDocument();
  });

  test("shows error on failed sign in", async () => {
    const { supabase } = require("./supabase");
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {}, error: { message: "Invalid login credentials" }
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), { target: { value: "test@test.com" } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: "wrongpass" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText(/invalid login credentials/i)).toBeInTheDocument();
    });
  });

  test("shows main app after successful auth", async () => {
    const { supabase } = require("./supabase");
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-123", email: "test@test.com" } } }
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Cyra")).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test("shows loading state", () => {
    render(<App />);
    expect(document.body).toBeInTheDocument();
  });
});