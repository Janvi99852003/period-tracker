import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders app", () => {
  render(<App />);
  expect(document.querySelector("div")).toBeInTheDocument();
});

test("renders current year", () => {
  render(<App />);
  expect(screen.getByText(new RegExp(new Date().getFullYear().toString()))).toBeInTheDocument();
});

test("renders cycles stat", () => {
  render(<App />);
  expect(screen.getAllByText(/Cycles/i)[0]).toBeInTheDocument();
});

test("renders avg days stat", () => {
  render(<App />);
  expect(screen.getAllByText(/Avg days/i)[0]).toBeInTheDocument();
});

test("renders health score", () => {
  render(<App />);
  expect(screen.getByText(/Health Score/i)).toBeInTheDocument();
});

test("renders all five tabs", () => {
  render(<App />);
  expect(screen.getAllByText(/Calendar/i)[0]).toBeInTheDocument();
  expect(screen.getAllByText(/Symptoms/i)[0]).toBeInTheDocument();
  expect(screen.getAllByText(/Charts/i)[0]).toBeInTheDocument();
  expect(screen.getAllByText(/Insights/i)[0]).toBeInTheDocument();
  expect(screen.getAllByText(/Settings/i)[0]).toBeInTheDocument();
});

test("renders log period button", () => {
  render(<App />);
  expect(screen.getByText(/Log period/i)).toBeInTheDocument();
});