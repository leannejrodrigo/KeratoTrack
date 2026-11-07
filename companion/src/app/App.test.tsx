/**
 * Integration tests: the real components, driven like a user would
 * (Testing Library queries by role and label, the way assistive technology
 * finds things), against the in-memory repository.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { RepositoryProvider } from "./RepositoryContext";
import { MemoryMeasurementRepository } from "../storage/memoryRepository";

function setup() {
  location.hash = "";
  const repo = new MemoryMeasurementRepository();
  const user = userEvent.setup();
  render(<RepositoryProvider repo={repo}><App /></RepositoryProvider>);
  return { repo, user };
}

describe("Companion app", () => {
  it("shows all five sections, marks unbuilt ones, and keeps the synthetic banner", async () => {
    const { user } = setup();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent?.replace(/Soon.*$/, ""))).toEqual(["Overview", "My Eyes", "Appointments", "Records", "Library"]);
    expect(within(nav).getByRole("link", { name: /Library.*not built yet/ })).toBeInTheDocument();
    await user.click(within(nav).getByRole("link", { name: /Appointments/ }));
    expect(await screen.findByRole("heading", { name: "Appointments is not built yet" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument() ;
    expect(screen.getByRole("note", { name: "Synthetic data notice" })).toHaveTextContent("SYNTHETIC DATA");
  });

  it("loads demo data and charts it with the factual summary", async () => {
    const { user, repo } = setup();
    await user.click(await screen.findByRole("button", { name: "Load demonstration data" }));
    expect(await screen.findByText(/Loaded \d+ synthetic demonstration measurements/)).toBeInTheDocument();
    expect((await repo.list()).every((m) => m.synthetic)).toBe(true);

    await user.click(screen.getByRole("button", { name: "View measurements" }));
    expect(await screen.findByText(/^Showing \d+ measurements from 2 devices\. 1 entry has no device recorded\.$/)).toBeInTheDocument();
    expect(screen.getByText(/does not start at zero/)).toBeInTheDocument();
  });

  it("adds a practice measurement, then deletes it with undo", async () => {
    const { user, repo } = setup();
    location.hash = "#/my-eyes";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await user.click(await screen.findByRole("button", { name: "Add measurement" }));

    // Submitting empty shows the GOV.UK error summary.
    await user.click(screen.getByRole("button", { name: "Save measurement" }));
    expect(screen.getByRole("alert")).toHaveTextContent("There is a problem");

    await user.click(screen.getByLabelText(/Maximum keratometry/));
    await user.click(screen.getByLabelText("Left eye (OS)"));
    // jsdom sanitises <input type="date"> on each keystroke, so set the full value at once.
    fireEvent.change(screen.getByLabelText("Date the measurement was taken"), { target: { value: "2026-03-03" } });
    await user.type(screen.getByLabelText(/^Value/), "48.2");
    await user.click(screen.getByLabelText("Device not recorded"));
    await user.click(screen.getByLabelText("Entered by you"));
    await user.click(screen.getByRole("button", { name: "Save measurement" }));

    expect(await screen.findByText(/Saved Kmax for left eye \(OS\), 3 Mar 2026/)).toBeInTheDocument();
    const [saved] = await repo.list();
    expect(saved).toMatchObject({ eye: "OS", value: 48.2, device: null, source: "enteredByUser", synthetic: true });
    expect(saved!.id.startsWith("SYN-")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Table" }));
    await user.click(screen.getByRole("button", { name: /^Delete/ }));
    expect(await repo.list()).toHaveLength(0);
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(await repo.list()).toEqual([saved]);
  });
});
