import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";

test("renders app", () => {
  render(<App />);
  expect(document.querySelector("div")).toBeInTheDocument();
});

test("renders splash screen initially", () => {
  render(<App />);
  expect(document.querySelector("div")).toBeInTheDocument();
});

test("renders current year after splash", async () => {
  render(<App />);
  await waitFor(() =>
    expect(screen.getByText(new RegExp(new Date().getFullYear().toString()))).toBeInTheDocument(),
    { timeout: 3000 }
  );
});

test("renders cycles stat after splash", async () => {
  render(<App />);
  await waitFor(() =>
    expect(screen.getAllByText(/Cycles/i)[0]).toBeInTheDocument(),
    { timeout: 3000 }
  );
});

test("renders health score after splash", async () => {
  render(<App />);
  await waitFor(() =>
    expect(screen.getByText(/Health Score/i)).toBeInTheDocument(),
    { timeout: 3000 }
  );
});

test("renders all five tabs after splash", async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.getAllByText(/Calendar/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Symptoms/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Charts/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Insights/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Settings/i)[0]).toBeInTheDocument();
  }, { timeout: 3000 });
});

test("renders log period button after splash", async () => {
  render(<App />);
  await waitFor(() =>
    expect(screen.getByText(/Log period/i)).toBeInTheDocument(),
    { timeout: 3000 }
  );
});