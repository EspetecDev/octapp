<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { gameState, sendMessage } from "$lib/socket.ts";
  import type { Chapter, TriviaQuestion, PowerUp } from "$lib/types.ts";
  import { serializeConfig, validateConfig } from "$lib/configSerializer";
  import * as m from '$lib/paraglide/messages.js';

  // Auth state (identical pattern to /admin)
  let authorized = $state<boolean | null>(null); // null = loading
  let token = $state<string>(""); // stored for link preservation (Pitfall 3)

  // Form state
  let chapters = $state<Chapter[]>([]);
  let powerUpCatalog = $state<PowerUp[]>([]);
  let startingTokens = $state<number>(0);
  let saveFlash = $state(false);
  let saveFlashTimer: ReturnType<typeof setTimeout> | null = null;
  let exportFlash = $state(false);
  let exportFlashTimer: ReturnType<typeof setTimeout> | null = null;
  let importFlash = $state(false);
  let importFlashTimer: ReturnType<typeof setTimeout> | null = null;
  let importConfirmPending = $state<{ config: import('$lib/configSerializer').GameConfig } | null>(null);
  let importError = $state<string>("");

  let importFileInput = $state<HTMLInputElement | null>(null);

  // Restore guard — only restore once from server state
  let restoredFromState = $state(false);

  // Restore form from $gameState on first sync (ADMN-05)
  $effect(() => {
    const gs = $gameState;
    if (!restoredFromState && gs && gs.chapters.length > 0) {
      chapters = structuredClone(gs.chapters);
      powerUpCatalog = structuredClone(gs.powerUpCatalog);
      startingTokens = gs.startingTokens ?? 0;
      restoredFromState = true;
    }
  });

  // Validation (computed)
  let isValid = $derived(
    chapters.length >= 1 &&
    chapters.every(
      (c) =>
        c.name.trim().length > 0 &&
        (c.minigameType !== "trivia" ||
          (c.triviaPool.length >= 1 &&
            c.triviaPool.every(
              (q) =>
                q.question.trim().length > 0 &&
                q.correctAnswer.trim().length > 0 &&
                q.wrongOptions[0].trim().length > 0 &&
                q.wrongOptions[1].trim().length > 0 &&
                q.wrongOptions[2].trim().length > 0
            ))) &&
        c.scavengerClue.trim().length > 0 &&
        c.reward.trim().length > 0
    )
  );

  // Auth on mount
  onMount(async () => {
    const t = $page.url.searchParams.get("token") ?? "";
    token = t;
    if (!t) {
      authorized = false;
      return;
    }
    try {
      const res = await fetch(`/api/admin/session?token=${encodeURIComponent(t)}`);
      authorized = res.ok;
    } catch {
      authorized = false;
    }
  });

  // --- Chapter management (Svelte 5 — always reassign root, never mutate in place) ---

  function addChapter() {
    if (chapters.length >= 5) return;
    chapters = [
      ...chapters,
      {
        name: "",
        minigameType: "trivia",
        triviaPool: [{ question: "", correctAnswer: "", wrongOptions: ["", "", ""] }],
        scavengerClue: "",
        scavengerHint: "",
        reward: "",
        servedQuestionIndex: null,
      },
    ];
  }

  function removeChapter(i: number) {
    chapters = chapters.filter((_, idx) => idx !== i);
  }

  function addQuestion(chapterIndex: number) {
    chapters = chapters.map((c, i) =>
      i === chapterIndex
        ? {
            ...c,
            triviaPool: [
              ...c.triviaPool,
              { question: "", correctAnswer: "", wrongOptions: ["", "", ""] as [string, string, string] },
            ],
          }
        : c
    );
  }

  function removeQuestion(chapterIndex: number, questionIndex: number) {
    chapters = chapters.map((c, i) =>
      i === chapterIndex
        ? { ...c, triviaPool: c.triviaPool.filter((_, qi) => qi !== questionIndex) }
        : c
    );
  }

  function updateChapterField<K extends keyof Chapter>(i: number, field: K, value: Chapter[K]) {
    chapters = chapters.map((c, idx) => (idx === i ? { ...c, [field]: value } : c));
  }

  function updateQuestion(
    ci: number,
    qi: number,
    field: keyof TriviaQuestion,
    value: string | [string, string, string]
  ) {
    chapters = chapters.map((c, i) =>
      i !== ci
        ? c
        : {
            ...c,
            triviaPool: c.triviaPool.map((q, j) => (j !== qi ? q : { ...q, [field]: value })),
          }
    );
  }

  function updateWrongOption(ci: number, qi: number, optionIndex: 0 | 1 | 2, value: string) {
    chapters = chapters.map((c, i) =>
      i !== ci
        ? c
        : {
            ...c,
            triviaPool: c.triviaPool.map((q, j) => {
              if (j !== qi) return q;
              const opts: [string, string, string] = [...q.wrongOptions] as [string, string, string];
              opts[optionIndex] = value;
              return { ...q, wrongOptions: opts };
            }),
          }
    );
  }

  // --- Power-up catalog management ---

  function addPowerUp() {
    powerUpCatalog = [
      ...powerUpCatalog,
      { name: "", description: "", tokenCost: 1, effectType: "timer_add" },
    ];
  }

  function removePowerUp(i: number) {
    powerUpCatalog = powerUpCatalog.filter((_, idx) => idx !== i);
  }

  function updatePowerUp<K extends keyof PowerUp>(i: number, field: K, value: PowerUp[K]) {
    powerUpCatalog = powerUpCatalog.map((p, idx) => (idx === i ? { ...p, [field]: value } : p));
  }

  // --- Save ---

  function saveSetup() {
    if (!isValid) return;
    sendMessage({ type: "SAVE_SETUP", chapters, powerUpCatalog, startingTokens });
    saveFlash = true;
    if (saveFlashTimer) clearTimeout(saveFlashTimer);
    saveFlashTimer = setTimeout(() => {
      saveFlash = false;
    }, 1500);
  }

  // --- Export (per D-01 through D-06 from 09-CONTEXT.md) ---

  function exportSetup() {
    if (!isValid) return;

    const config = serializeConfig(chapters, powerUpCatalog, startingTokens);
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    if (/iP(hone|ad|od)/i.test(navigator.userAgent)) {
      // WebKit bug #216918 — <a download> + blob URL silently fails on iOS Safari.
      // window.open triggers the share sheet; user can save from there.
      // Do NOT revoke — the open tab holds the reference (per D-06).
      window.open(url, "_blank");
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = "octapp-setup.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    exportFlash = true;
    if (exportFlashTimer) clearTimeout(exportFlashTimer);
    exportFlashTimer = setTimeout(() => {
      exportFlash = false;
    }, 1500);
  }

  // --- Import (per D-01 through D-07 from 10-CONTEXT.md) ---

  function triggerImport() {
    importError = "";
    importFileInput?.click();
  }

  function importSetup(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(e.target?.result as string);
      } catch {
        importError = m.admin_setup_import_error_invalid_json();
        importConfirmPending = null;
        return;
      }

      const result = validateConfig(parsed);
      if (!result.ok) {
        importError = result.error;
        importConfirmPending = null;
        return;
      }

      // Valid config — enter confirm mode (D-03)
      importError = "";
      importConfirmPending = { config: result.config };
    };
    reader.readAsText(file);

    // Reset file input so re-selecting the same file triggers onchange again
    input.value = "";
  }

  function confirmImport() {
    if (!importConfirmPending) return;
    // $state.snapshot() returns a plain (non-proxied) deep copy — required because
    // importConfirmPending is $state, so .config.chapters is a Svelte reactive proxy
    // and structuredClone on a proxy produces unexpected results.
    const { config } = $state.snapshot(importConfirmPending);

    chapters = config.chapters as typeof chapters;
    powerUpCatalog = config.powerUpCatalog;
    startingTokens = config.startingTokens;

    // Set restore guard so next STATE_SYNC does not overwrite (D-07)
    restoredFromState = true;

    importConfirmPending = null;
    importError = "";

    // Brief flash feedback (analogous to saveFlash / exportFlash)
    importFlash = true;
    if (importFlashTimer) clearTimeout(importFlashTimer);
    importFlashTimer = setTimeout(() => { importFlash = false; }, 1500);
  }

  function cancelImport() {
    importConfirmPending = null;
    importError = "";
  }
</script>

{#if authorized === null}
  <!-- Loading -->
  <main class="flex min-h-[100dvh] items-center justify-center bg-bg">
    <div class="w-8 h-8 rounded-full border-2 border-accent-admin border-t-transparent animate-spin"></div>
  </main>

{:else if authorized === false}
  <!-- Unauthorized -->
  <main class="flex min-h-[100dvh] items-center justify-center bg-bg">
    <p class="text-[24px] font-bold text-text-primary">{m.admin_setup_access_denied()}</p>
  </main>

{:else}
  <!-- Authorized: pre-event setup form -->
  <main class="min-h-[100dvh] bg-bg px-4 pb-32">

    <!-- Page header -->
    <header class="pt-6 pb-4 flex items-center justify-between">
      <h1 class="text-[24px] font-bold text-text-primary">{m.admin_setup_page_title()}</h1>
      <a href="/admin?token={token}" class="text-[14px] text-text-secondary">{m.admin_setup_back_link()}</a>
    </header>

    <!-- Chapters empty state -->
    {#if chapters.length === 0}
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <p class="text-[24px] font-bold text-text-primary mb-2">{m.admin_setup_no_chapters_heading()}</p>
        <p class="text-base text-text-secondary">{m.admin_setup_no_chapters_body()}</p>
      </div>
    {/if}

    <!-- Chapter blocks -->
    {#each chapters as chapter, i}
      <section class="bg-surface rounded-xl border border-border p-6 mb-6">

        <!-- Chapter header -->
        <div class="flex items-center mb-4">
          <span class="text-[14px] text-text-secondary">{m.admin_setup_chapter_label({ number: i + 1 })}</span>
          <button
            onclick={() => removeChapter(i)}
            class="ml-auto text-[14px] text-destructive min-h-[44px] px-2"
          >
            {m.admin_setup_remove_chapter_btn()}
          </button>
        </div>

        <!-- Chapter name -->
        <div class="mb-4">
          <input
            type="text"
            placeholder={m.admin_setup_chapter_name_placeholder()}
            class="w-full bg-bg border border-border rounded-lg px-4 py-2 text-[24px] font-bold text-text-primary"
            value={chapter.name}
            oninput={(e) => updateChapterField(i, "name", (e.target as HTMLInputElement).value)}
          />
        </div>

        <!-- Minigame type selector -->
        <div class="flex gap-2 mb-4">
          {#each (["trivia", "memory"] as const) as type}
            <button
              onclick={() => updateChapterField(i, "minigameType", type)}
              class="min-h-[44px] px-4 rounded-lg {chapter.minigameType === type
                ? 'border-2 border-accent-admin text-text-primary bg-surface'
                : 'border border-border text-text-secondary'}"
            >
              {type === "trivia" ? m.admin_setup_minigame_trivia() : m.admin_setup_minigame_memory()}
            </button>
          {/each}
        </div>

        <!-- Trivia pool (only when type is trivia) -->
        {#if chapter.minigameType === "trivia"}
          <div class="mb-4">
            <p class="text-[14px] text-text-secondary mb-2">{m.admin_setup_trivia_section_label()}</p>

            {#each chapter.triviaPool as question, qi}
              <div class="bg-bg border border-border rounded-lg p-4 mb-3">
                <div class="flex items-start justify-between mb-2">
                  <span class="text-[14px] text-text-secondary">{m.admin_setup_question_label({ number: qi + 1 })}</span>
                  <button
                    onclick={() => removeQuestion(i, qi)}
                    class="text-[14px] text-destructive min-h-[44px] px-2"
                  >
                    {m.admin_setup_remove_question_btn()}
                  </button>
                </div>

                <!-- Question text -->
                <textarea
                  rows="1"
                  placeholder={m.admin_setup_question_placeholder()}
                  class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-base text-text-primary mb-2 resize-none"
                  value={question.question}
                  oninput={(e) => updateQuestion(i, qi, "question", (e.target as HTMLTextAreaElement).value)}
                ></textarea>

                <!-- Correct answer -->
                <input
                  type="text"
                  placeholder={m.admin_setup_correct_answer_placeholder()}
                  class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-base text-text-primary mb-2"
                  value={question.correctAnswer}
                  oninput={(e) => updateQuestion(i, qi, "correctAnswer", (e.target as HTMLInputElement).value)}
                />

                <!-- Wrong options -->
                <input
                  type="text"
                  placeholder={m.admin_setup_wrong_option_1_placeholder()}
                  class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-base text-text-primary mb-2"
                  value={question.wrongOptions[0]}
                  oninput={(e) => updateWrongOption(i, qi, 0, (e.target as HTMLInputElement).value)}
                />
                <input
                  type="text"
                  placeholder={m.admin_setup_wrong_option_2_placeholder()}
                  class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-base text-text-primary mb-2"
                  value={question.wrongOptions[1]}
                  oninput={(e) => updateWrongOption(i, qi, 1, (e.target as HTMLInputElement).value)}
                />
                <input
                  type="text"
                  placeholder={m.admin_setup_wrong_option_3_placeholder()}
                  class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-base text-text-primary"
                  value={question.wrongOptions[2]}
                  oninput={(e) => updateWrongOption(i, qi, 2, (e.target as HTMLInputElement).value)}
                />
              </div>
            {/each}

            <button
              onclick={() => addQuestion(i)}
              class="text-[14px] text-text-secondary min-h-[44px] px-2"
            >
              {m.admin_setup_add_question_btn()}
            </button>
          </div>
        {/if}

        <!-- Scavenger clue -->
        <div class="mb-4">
          <label class="block text-[14px] text-text-secondary mb-1">{m.admin_setup_scavenger_clue_label()}</label>
          <textarea
            rows="3"
            placeholder={m.admin_setup_scavenger_clue_placeholder()}
            class="w-full bg-bg border border-border rounded-lg px-4 py-2 text-base text-text-primary resize-none"
            value={chapter.scavengerClue}
            oninput={(e) => updateChapterField(i, "scavengerClue", (e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </div>

        <!-- Scavenger hint (optional) -->
        <div class="mb-4">
          <label class="block text-[14px] text-text-secondary mb-1">{m.admin_setup_hint_label()}</label>
          <input
            type="text"
            placeholder={m.admin_setup_hint_placeholder()}
            class="w-full bg-bg border border-border rounded-lg px-4 py-2 text-base text-text-primary"
            value={chapter.scavengerHint ?? ""}
            oninput={(e) => updateChapterField(i, "scavengerHint", (e.target as HTMLInputElement).value)}
          />
        </div>

        <!-- Reward -->
        <div>
          <label class="block text-[14px] text-text-secondary mb-1">{m.admin_setup_reward_label()}</label>
          <textarea
            rows="2"
            placeholder={m.admin_setup_reward_placeholder()}
            class="w-full bg-bg border border-border rounded-lg px-4 py-2 text-base text-text-primary resize-none"
            value={chapter.reward}
            oninput={(e) => updateChapterField(i, "reward", (e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </div>

      </section>
    {/each}

    <!-- Add Chapter button -->
    <button
      onclick={addChapter}
      disabled={chapters.length >= 5}
      class:opacity-40={chapters.length >= 5}
      class="w-full border border-border border-dashed rounded-xl text-[14px] text-text-secondary min-h-[44px] mb-8"
    >
      {m.admin_setup_add_chapter_btn()}
    </button>

    <!-- Power-ups & Sabotages section -->
    <section class="mb-8">
      <h2 class="text-[24px] font-bold text-text-primary mb-4">{m.admin_setup_powerups_section_title()}</h2>

      <div class="flex items-center gap-3 mb-4">
        <label
          for="starting-tokens"
          class="text-[14px] text-text-secondary"
        >{m.admin_setup_starting_tokens_label()}</label>
        <input
          id="starting-tokens"
          type="number"
          min="0"
          placeholder={m.admin_setup_starting_tokens_placeholder()}
          class="w-20 bg-bg border border-border rounded-lg px-2 py-2 text-base text-text-primary text-center min-h-[44px]"
          value={startingTokens}
          oninput={(e) => { startingTokens = Number((e.target as HTMLInputElement).value) || 0; }}
        />
      </div>

      {#each powerUpCatalog as powerUp, i}
        <div class="bg-surface border border-border rounded-xl p-4 mb-3 flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-[14px] text-text-secondary">{m.admin_setup_entry_label({ number: i + 1 })}</span>
            <button
              onclick={() => removePowerUp(i)}
              class="text-[14px] text-destructive min-h-[44px] px-2"
            >
              {m.admin_setup_remove_powerup_btn()}
            </button>
          </div>

          <!-- Name -->
          <input
            type="text"
            placeholder={m.admin_setup_powerup_name_placeholder()}
            class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-base text-text-primary"
            value={powerUp.name}
            oninput={(e) => updatePowerUp(i, "name", (e.target as HTMLInputElement).value)}
          />

          <!-- Description -->
          <input
            type="text"
            placeholder={m.admin_setup_powerup_desc_placeholder()}
            class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-base text-text-primary"
            value={powerUp.description}
            oninput={(e) => updatePowerUp(i, "description", (e.target as HTMLInputElement).value)}
          />

          <div class="flex items-center gap-3">
            <!-- Token cost -->
            <div class="flex items-center gap-2">
              <label class="text-[14px] text-text-secondary">{m.admin_setup_cost_label()}</label>
              <input
                type="number"
                min="1"
                class="w-16 bg-bg border border-border rounded-lg px-2 py-2 text-base text-text-primary text-center"
                value={powerUp.tokenCost}
                oninput={(e) => updatePowerUp(i, "tokenCost", Number((e.target as HTMLInputElement).value))}
              />
            </div>

            <!-- Effect type -->
            <div class="flex items-center gap-2 flex-1">
              <label class="text-[14px] text-text-secondary">{m.admin_setup_effect_label()}</label>
              <select
                class="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-base text-text-primary min-h-[44px]"
                value={powerUp.effectType}
                onchange={(e) => updatePowerUp(i, "effectType", (e.target as HTMLSelectElement).value)}
              >
                <option value="timer_add">{m.admin_setup_effect_timer_add()}</option>
                <option value="scramble_options">{m.admin_setup_effect_scramble()}</option>
                <option value="distraction">{m.admin_setup_effect_distraction()}</option>
              </select>
            </div>
          </div>
        </div>
      {/each}

      <button
        onclick={addPowerUp}
        class="w-full border border-accent-admin text-accent-admin min-h-[44px] rounded-xl text-[14px]"
      >
        {m.admin_setup_add_powerup_btn()}
      </button>
    </section>

  </main>

  <!-- Hidden file input for import -->
  <input
    type="file"
    accept=".json"
    class="hidden"
    bind:this={importFileInput}
    onchange={importSetup}
  />

  <!-- Error strip — fixed above sticky bar, visible only when importError is set (D-05, D-06) -->
  {#if importError}
    <div class="fixed bottom-[88px] left-0 right-0 px-4">
      <div class="bg-bg border border-red-500 rounded-xl px-4 py-3 text-[14px] text-red-400">
        ⚠ {importError}
      </div>
    </div>
  {/if}

  <!-- Sticky action bar: Import (left) | Export (middle) | Save (right) — per D-01 -->
  <!-- Confirm mode swaps the three buttons for "Replace setup?" + Cancel + Yes, Replace — per D-03, D-04 -->
  <div class="fixed bottom-0 left-0 right-0 bg-bg pb-6 px-4 pt-2 flex gap-2">
    {#if importConfirmPending}
      <!-- Confirm mode -->
      <p class="flex items-center text-[14px] text-text-secondary mr-2 shrink-0">{m.admin_setup_replace_confirm()}</p>
      <button
        onclick={cancelImport}
        class="flex-1 min-h-[48px] border border-border text-text-secondary font-bold rounded-xl"
      >
        {m.admin_setup_cancel_btn()}
      </button>
      <button
        onclick={confirmImport}
        class="flex-1 min-h-[48px] bg-accent-admin text-text-primary font-bold rounded-xl"
      >
        {m.admin_setup_yes_replace_btn()}
      </button>
    {:else}
      <!-- Normal three-button mode -->
      <button
        onclick={triggerImport}
        class="flex-1 min-h-[48px] border border-accent-admin text-accent-admin font-bold rounded-xl {importFlash ? 'opacity-70' : ''}"
      >
        {importFlash ? m.admin_setup_imported_btn() : m.admin_setup_import_btn()}
      </button>
      <button
        onclick={exportSetup}
        disabled={!isValid}
        class="flex-1 min-h-[48px] border border-accent-admin text-accent-admin font-bold rounded-xl disabled:opacity-50 disabled:pointer-events-none"
      >
        {exportFlash ? m.admin_setup_exported_btn() : m.admin_setup_export_btn()}
      </button>
      <button
        onclick={saveSetup}
        disabled={!isValid}
        class="flex-1 min-h-[48px] bg-accent-admin text-text-primary font-bold rounded-xl disabled:opacity-50 disabled:pointer-events-none"
        style={saveFlash ? "background: #22c55e;" : ""}
      >
        {saveFlash ? m.admin_setup_saved_btn() : m.admin_setup_save_btn()}
      </button>
    {/if}
  </div>
{/if}
