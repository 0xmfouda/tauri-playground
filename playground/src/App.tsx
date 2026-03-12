import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type Operator = "+" | "-" | "*" | "/";

const digitRows = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
];

function formatResult(value: number) {
  if (!Number.isFinite(value)) {
    return "Error";
  }

  const formatted = value.toString();
  return formatted.length > 12 ? value.toPrecision(8) : formatted;
}

function App() {
  const [display, setDisplay] = useState("0");
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [pendingOperator, setPendingOperator] = useState<Operator | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [status, setStatus] = useState("Ready");
  const hasError = display === "Error";

  function resetCalculator(nextStatus = "Cleared") {
    setDisplay("0");
    setStoredValue(null);
    setPendingOperator(null);
    setWaitingForOperand(false);
    setStatus(nextStatus);
  }

  function inputDigit(digit: string) {
    setStatus("Editing");

    if (waitingForOperand || hasError) {
      setDisplay(digit);
      setWaitingForOperand(false);
      return;
    }

    setDisplay((currentValue) => (currentValue === "0" ? digit : `${currentValue}${digit}`));
  }

  function inputDecimal() {
    setStatus("Editing");

    if (waitingForOperand || hasError) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }

    setDisplay((currentValue) =>
      currentValue.includes(".") ? currentValue : `${currentValue}.`,
    );
  }

  function toggleSign() {
    if (hasError) {
      return;
    }

    setDisplay((currentValue) =>
      currentValue === "0" ? currentValue : formatResult(Number(currentValue) * -1),
    );
    setStatus("Sign flipped");
  }

  function toPercent() {
    if (hasError) {
      return;
    }

    setDisplay((currentValue) => formatResult(Number(currentValue) / 100));
    setStatus("Converted to percent");
  }

  async function runCalculation(nextOperator?: Operator) {
    if (!pendingOperator || storedValue === null) {
      return;
    }

    const right = Number(display);

    try {
      // The reason the arithmetic was pushed into Rust here was to teach the core Tauri idea: 
      // the frontend is just a UI layer, and Rust is the native backend you can call through invoke().
      const result = await invoke<number>("calculate", {
        left: storedValue,
        right,
        operator: pendingOperator,
      });

      const formatted = formatResult(result);
      setDisplay(formatted);
      setStoredValue(nextOperator ? result : null);
      setPendingOperator(nextOperator ?? null);
      setWaitingForOperand(Boolean(nextOperator));
      setStatus(`Rust computed ${storedValue} ${pendingOperator} ${right}`);
    } catch (error) {
      resetCalculator("Rust rejected the calculation");
      setDisplay("Error");
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function chooseOperator(operator: Operator) {
    if (hasError) {
      return;
    }

    const currentValue = Number(display);

    if (storedValue === null) {
      setStoredValue(currentValue);
      setPendingOperator(operator);
      setWaitingForOperand(true);
      setStatus(`Stored ${currentValue} and waiting for the next value`);
      return;
    }

    if (waitingForOperand) {
      setPendingOperator(operator);
      setStatus(`Operator changed to ${operator}`);
      return;
    }

    await runCalculation(operator);
  }

  async function calculateResult() {
    if (hasError || !pendingOperator || storedValue === null || waitingForOperand) {
      return;
    }

    await runCalculation();
  }

  return (
    <main className="app-shell">
      <section className="intro-panel">
        <p className="eyebrow">Tauri calculator</p>
        <h1>React renders the interface. Rust computes the answer.</h1>
        <p className="intro-copy">
          Enter numbers in the React UI, then press an operator or equals. When a
          calculation is needed, the app calls Tauri&apos;s <code>invoke()</code> bridge
          and Rust returns the result.
        </p>
        <div className="bridge-card">
          <span>Frontend</span>
          <strong>
            {storedValue !== null && pendingOperator
              ? `${storedValue} ${pendingOperator} ${display}`
              : display}
          </strong>
          <span>Backend status</span>
          <strong>{status}</strong>
        </div>
      </section>

      <section className="calculator" aria-label="Calculator">
        <div className="display-panel">
          <p className="display-label">Current value</p>
          <output className="display">{display}</output>
        </div>

        <div className="keypad">
          <button className="key utility" type="button" onClick={() => resetCalculator()}>
            AC
          </button>
          <button className="key utility" type="button" onClick={toggleSign}>
            +/-
          </button>
          <button className="key utility" type="button" onClick={toPercent}>
            %
          </button>
          <button className="key operator" type="button" onClick={() => chooseOperator("/")}>
            /
          </button>

          {digitRows.map((row) =>
            row.map((digit) => (
              <button
                key={digit}
                className="key digit"
                type="button"
                onClick={() => inputDigit(digit)}
              >
                {digit}
              </button>
            )),
          )}

          <button className="key operator" type="button" onClick={() => chooseOperator("*")}>
            *
          </button>
          <button className="key operator" type="button" onClick={() => chooseOperator("-")}>
            -
          </button>
          <button className="key zero" type="button" onClick={() => inputDigit("0")}>
            0
          </button>
          <button className="key digit" type="button" onClick={inputDecimal}>
            .
          </button>
          <button className="key operator" type="button" onClick={() => chooseOperator("+")}>
            +
          </button>
          <button className="key equals" type="button" onClick={calculateResult}>
            =
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;
