import { render, screen, waitFor, fireEvent } from "@testing-library/react";

jest.mock("recharts", () => ({
  LineChart: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  Line: () => null, Bar: () => null,
  XAxis: () => null, YAxis: () => null,
  Tooltip: () => null, CartesianGrid: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

jest.mock("@emailjs/browser", () => ({
  send: () => Promise.resolve({ status: 200, text: "OK" }),
}));

jest.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ data: {}, error: null }),
      signUp: () => Promise.resolve({ data: {}, error: null }),
      signOut: () => Promise.resolve({}),
      resetPasswordForEmail: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: function() { return this; },
      eq: function() { return this; },
      single: () => Promise.resolve({ data: null, error: { code: "PGRST116" } }),
      upsert: () => Promise.resolve({ error: null }),
      delete: function() { return this; },
    }),
    functions: {
      invoke: () => Promise.resolve({ data: {}, error: null }),
    },
  },
}));

// Mock the global fetch used by the Gemini AI Assistant tab
beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        candidates: [
          { content: { parts: [{ text: "This is a mocked Gemini response." }] } }
        ]
      }),
    })
  );
});

afterAll(() => {
  delete global.fetch;
});

import App from "./App";

beforeEach(() => { localStorage.clear(); });

test("renders without crashing", () => {
  render(<App />);
  expect(document.body).toBeInTheDocument();
});

test("shows splash screen", () => {
  render(<App />);
  expect(screen.getByText(/your cycle, your way/i)).toBeInTheDocument();
});

test("shows login screen after splash", async () => {
  render(<App />);
  await waitFor(() => expect(screen.getByText(/welcome back/i)).toBeInTheDocument(), { timeout: 4000 });
});

test("has email input on login screen", async () => {
  render(<App />);
  await waitFor(() => expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument(), { timeout: 4000 });
});

test("has password input on login screen", async () => {
  render(<App />);
  await waitFor(() => expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument(), { timeout: 4000 });
});

test("has forgot password link", async () => {
  render(<App />);
  await waitFor(() => expect(screen.getByText(/forgot password/i)).toBeInTheDocument(), { timeout: 4000 });
});

test("shows forgot password screen on click", async () => {
  render(<App />);
  await waitFor(() => screen.getByText(/forgot password/i), { timeout: 4000 });
  fireEvent.click(screen.getByText(/forgot password/i));
  expect(screen.getByText(/reset password/i)).toBeInTheDocument();
});

test("has OTP sign up button", async () => {
  render(<App />);
  await waitFor(() => expect(screen.getByText(/sign up with otp/i)).toBeInTheDocument(), { timeout: 4000 });
});

test("shows OTP request screen on click", async () => {
  render(<App />);
  await waitFor(() => screen.getByText(/sign up with otp/i), { timeout: 4000 });
  fireEvent.click(screen.getByText(/sign up with otp/i));
  expect(screen.getByText(/no password needed/i)).toBeInTheDocument();
});

test("sends OTP via EmailJS and shows verify screen", async () => {
  render(<App />);
  await waitFor(() => screen.getByText(/sign up with otp/i), { timeout: 4000 });
  fireEvent.click(screen.getByText(/sign up with otp/i));

  const emailInput = screen.getByPlaceholderText(/you@example.com/i);
  fireEvent.change(emailInput, { target: { value: "newuser@example.com" } });
  fireEvent.click(screen.getByText(/send otp/i));

  await waitFor(() => {
    expect(screen.getByText(/enter code/i)).toBeInTheDocument();
  }, { timeout: 4000 });
});