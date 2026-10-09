/** A quiet house view, with native fullscreen where the browser allows it. */
export class FullscreenView {
  private active = false;
  private native = false;
  private hideTimer: number | undefined;
  private scrollY = 0;

  constructor(
    private stage: HTMLElement,
    private enterButton: HTMLButtonElement,
    private exitButton: HTMLButtonElement,
    private hint: HTMLElement,
    private onChange: (active: boolean) => void,
  ) {
    enterButton.onclick = () => void this.enter();
    exitButton.onclick = () => void this.exit();
    stage.addEventListener("pointermove", () => this.revealControls());
    stage.addEventListener("pointerdown", () => this.revealControls());
    stage.addEventListener("focusin", () => this.revealControls());
    stage.addEventListener("focusout", () => this.revealControls());
    stage.addEventListener("toggle", () => this.revealControls(), true);
    document.addEventListener("keydown", (event) => {
      if (!this.active) return;
      if (event.key === "Escape") {
        event.preventDefault();
        const disclosure = stage.querySelector<HTMLDetailsElement>(
          ".time-controls[open]",
        );
        if (disclosure) {
          // Escape dismisses the open time panel even after Tab reaches Exit.
          event.stopPropagation();
          disclosure.open = false;
          disclosure.querySelector("summary")?.focus({ preventScroll: true });
        } else void this.exit();
      } else if (event.key === "Tab") {
        event.preventDefault();
        this.revealControls();
        const controls = Array.from(
          stage.querySelectorAll<HTMLElement>(
            'button:not(:disabled), summary, a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ),
        ).filter((control) => {
          const closedDisclosure = control.closest("details:not([open])");
          if (
            closedDisclosure &&
            control !== closedDisclosure.querySelector(":scope > summary")
          )
            return false;
          return control.getClientRects().length > 0;
        });
        const current = controls.indexOf(document.activeElement as HTMLElement);
        const next =
          current < 0
            ? event.shiftKey
              ? controls.length - 1
              : 0
            : (current + (event.shiftKey ? -1 : 1) + controls.length) %
              controls.length;
        controls[next]?.focus({ preventScroll: true });
      }
    });
    document.addEventListener("fullscreenchange", () => {
      if (document.fullscreenElement === stage) this.native = true;
      else if (this.native) this.finish();
    });
  }

  private revealControls() {
    if (!this.active) return;
    this.stage.classList.add("controls-visible");
    clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => {
      const focused = document.activeElement;
      if (
        !(
          focused instanceof HTMLElement &&
          focused !== this.stage &&
          this.stage.contains(focused)
        ) &&
        !this.stage.querySelector(".time-controls[open]")
      )
        this.stage.classList.remove("controls-visible");
    }, 2500);
  }

  private async enter() {
    if (this.active) return;
    this.active = true;
    this.scrollY = window.scrollY;
    document.body.classList.add("house-fullscreen");
    this.enterButton.setAttribute("aria-pressed", "true");
    this.hint.textContent = "Esc to return · move or tap for controls";
    this.onChange(true);
    this.stage.focus({ preventScroll: true });
    this.revealControls();
    try {
      if (!this.stage.requestFullscreen) throw new Error("Unavailable");
      await this.stage.requestFullscreen();
      // An exit gesture may arrive while the browser is entering fullscreen.
      if (!this.active && document.fullscreenElement === this.stage)
        await document.exitFullscreen();
    } catch {
      if (this.active)
        this.hint.textContent =
          "House-only view · Esc or tap the button to return";
    }
  }

  private async exit() {
    if (document.fullscreenElement === this.stage) {
      try {
        await document.exitFullscreen();
      } catch {
        this.hint.textContent = "Press Esc to leave fullscreen";
        this.revealControls();
        return;
      }
    }
    this.finish();
  }

  private finish() {
    this.native = false;
    if (!this.active) return;
    this.active = false;
    clearTimeout(this.hideTimer);
    this.stage.classList.remove("controls-visible");
    document.body.classList.remove("house-fullscreen");
    this.enterButton.setAttribute("aria-pressed", "false");
    this.onChange(false);
    this.enterButton.focus({ preventScroll: true });
    window.scrollTo({ top: this.scrollY, behavior: "instant" });
  }
}
