<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import type { Chapter, TriviaQuestion, Milestone } from "$lib/types.ts";
  import { serializeConfig, validateConfig, type GameConfig } from "$lib/configSerializer";
  import * as m from '$lib/paraglide/messages.js';

  type SavedGameConfigSummary = {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    chapterCount: number;
  };

  type SavedGameConfig = Omit<SavedGameConfigSummary, "chapterCount"> & {
    config: GameConfig;
  };

  // Auth state (identical pattern to /admin)
  let authorized = $state<boolean | null>(null); // null = loading
  let token = $state<string>(""); // stored for link preservation (Pitfall 3)
  let configs = $state<SavedGameConfigSummary[]>([]);
  let currentConfigId = $state<string | null>(null);
  let configName = $state("Wedding game");
  let pageError = $state("");
  let loadingConfig = $state(false);

  // Form state
  let chapters = $state<Chapter[]>([]);
  let milestones = $state<Milestone[]>([]);
  let saveFlash = $state(false);
  let saveFlashTimer: ReturnType<typeof setTimeout> | null = null;
  let exportFlash = $state(false);
  let exportFlashTimer: ReturnType<typeof setTimeout> | null = null;
  let importFlash = $state(false);
  let importFlashTimer: ReturnType<typeof setTimeout> | null = null;
  let importConfirmPending = $state<{ config: import('$lib/configSerializer').GameConfig } | null>(null);
  let importError = $state<string>("");

  let importFileInput = $state<HTMLInputElement | null>(null);

  // Validation (computed)
  let isValid = $derived(
    chapters.length >= 1 &&
    milestones.length >= 1 &&
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
    ) &&
    milestones.every((milestone) => milestone.points > 0 && milestone.reward.trim().length > 0)
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
      if (res.ok) {
        await loadConfigList();
        const requestedConfigId = $page.url.searchParams.get("config");
        if (requestedConfigId) {
          await loadConfig(requestedConfigId);
        } else if (configs.length > 0) {
          await loadConfig(configs[0].id);
        }
      }
    } catch {
      authorized = false;
    }
  });

  function blankChapter(): Chapter {
    return {
      name: "",
      minigameType: "trivia",
      triviaPool: [{ question: "", correctAnswer: "", wrongOptions: ["", "", ""] }],
      scavengerClue: "",
      scavengerHint: "",
      reward: "",
      servedQuestionIndex: null,
      minigameDone: false,
      scavengerDone: false,
    };
  }

  function blankMilestone(points = 100): Milestone {
    return {
      id: crypto.randomUUID(),
      points,
      reward: "",
      unlocked: false,
    };
  }

  function apiUrl(path: string) {
    return `${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  }

  async function loadConfigList() {
    const res = await fetch(apiUrl("/api/admin/configs"));
    if (!res.ok) throw new Error("Failed to load configs");
    const data = await res.json() as { configs: SavedGameConfigSummary[] };
    configs = data.configs;
  }

  function applyConfig(record: SavedGameConfig) {
    currentConfigId = record.id;
    configName = record.name;
    chapters = record.config.chapters.map((chapter) => ({
      ...chapter,
      servedQuestionIndex: null,
      minigameDone: false,
      scavengerDone: false,
    }));
    milestones = (record.config.milestones ?? []).map((milestone) => ({
      id: milestone.id ?? crypto.randomUUID(),
      points: milestone.points,
      reward: milestone.reward,
      unlocked: false,
    }));
    if (milestones.length === 0) milestones = [blankMilestone(100), blankMilestone(200), blankMilestone(300)];
    pageError = "";
  }

  async function loadConfig(id: string) {
    loadingConfig = true;
    pageError = "";
    try {
      const res = await fetch(apiUrl(`/api/admin/configs/${id}`));
      if (!res.ok) throw new Error("Config not found");
      applyConfig(await res.json() as SavedGameConfig);
    } catch (error) {
      pageError = error instanceof Error ? error.message : "Failed to load config";
    } finally {
      loadingConfig = false;
    }
  }

  function newConfig() {
    currentConfigId = null;
    configName = "Wedding game";
    chapters = [blankChapter()];
    milestones = [blankMilestone(100), blankMilestone(200), blankMilestone(300)];
    pageError = "";
  }

  function duplicateConfig() {
    currentConfigId = null;
    configName = `${configName} copy`;
    pageError = "";
  }

  // --- Chapter management (Svelte 5 — always reassign root, never mutate in place) ---

  function addChapter() {
    if (chapters.length >= 5) return;
    chapters = [...chapters, blankChapter()];
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

  // --- Milestone management ---

  function addMilestone() {
    const nextPoints = Math.max(0, ...milestones.map((milestone) => milestone.points)) + 100;
    milestones = [...milestones, blankMilestone(nextPoints)];
  }

  function removeMilestone(i: number) {
    milestones = milestones.filter((_, idx) => idx !== i);
  }

  function updateMilestone<K extends keyof Milestone>(i: number, field: K, value: Milestone[K]) {
    milestones = milestones.map((milestone, idx) => (idx === i ? { ...milestone, [field]: value } : milestone));
  }

  // --- Save ---

  async function saveSetup(): Promise<string | null> {
    if (!isValid) return null;
    pageError = "";
    const payload = {
      name: configName,
      config: serializeConfig(chapters, milestones),
    };
    const path = currentConfigId ? `/api/admin/configs/${currentConfigId}` : "/api/admin/configs";
    const res = await fetch(apiUrl(path), {
      method: currentConfigId ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Failed to save config" })) as { error?: string };
      pageError = body.error ?? "Failed to save config";
      return null;
    }
    const record = await res.json() as SavedGameConfig;
    applyConfig(record);
    await loadConfigList();
    saveFlash = true;
    if (saveFlashTimer) clearTimeout(saveFlashTimer);
    saveFlashTimer = setTimeout(() => {
      saveFlash = false;
    }, 1500);
    return record.id;
  }

  async function deleteConfig() {
    if (!currentConfigId) return;
    if (!confirm(`Delete "${configName}"? This cannot be undone.`)) return;
    const res = await fetch(apiUrl(`/api/admin/configs/${currentConfigId}`), { method: "DELETE" });
    if (!res.ok) {
      pageError = "Failed to delete config";
      return;
    }
    await loadConfigList();
    if (configs.length > 0) {
      await loadConfig(configs[0].id);
    } else {
      newConfig();
    }
  }

  async function launchConfig() {
    if (!confirm("Launch a fresh session from this config? The current live session will be replaced.")) return;
    const id = currentConfigId ?? await saveSetup();
    if (!id) return;
    const res = await fetch(apiUrl("/api/admin/sessions/launch"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ configId: id }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Failed to launch session" })) as { error?: string };
      pageError = body.error ?? "Failed to launch session";
      return;
    }
    window.location.href = `/admin?token=${encodeURIComponent(token)}`;
  }

  // --- Export (per D-01 through D-06 from 09-CONTEXT.md) ---

  function exportSetup() {
    if (!isValid) return;

    const config = serializeConfig(chapters, milestones);
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

    chapters = config.chapters.map((chapter) => ({
      ...chapter,
      servedQuestionIndex: null,
      minigameDone: false,
      scavengerDone: false,
    }));
    milestones = (config.milestones ?? []).map((milestone) => ({
      id: milestone.id ?? crypto.randomUUID(),
      points: milestone.points,
      reward: milestone.reward,
      unlocked: false,
    }));
    if (milestones.length === 0) milestones = [blankMilestone(100), blankMilestone(200), blankMilestone(300)];

    currentConfigId = null;
    configName = "Imported game";

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

    <section class="bg-surface rounded-xl border border-border p-4 mb-6">
      <label class="block text-[14px] text-text-secondary mb-2" for="config-name">Game config</label>
      <input
        id="config-name"
        type="text"
        class="w-full bg-bg border border-border rounded-lg px-4 py-2 text-[20px] font-bold text-text-primary mb-3"
        value={configName}
        oninput={(e) => { configName = (e.target as HTMLInputElement).value; }}
      />

      <div class="flex gap-2 mb-3">
        <select
          class="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-base text-text-primary min-h-[44px]"
          value={currentConfigId ?? ""}
          disabled={loadingConfig || configs.length === 0}
          onchange={(e) => {
            const id = (e.target as HTMLSelectElement).value;
            if (id) void loadConfig(id);
          }}
        >
          {#if configs.length === 0}
            <option value="">No saved configs</option>
          {:else}
            {#each configs as config}
              <option value={config.id}>{config.name} ({config.chapterCount})</option>
            {/each}
          {/if}
        </select>
        <button
          onclick={newConfig}
          class="min-h-[44px] px-4 rounded-lg border border-border text-text-secondary"
        >
          New
        </button>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <button
          onclick={duplicateConfig}
          disabled={chapters.length === 0}
          class="min-h-[44px] rounded-lg border border-border text-text-secondary disabled:opacity-50"
        >
          Duplicate
        </button>
        <button
          onclick={deleteConfig}
          disabled={!currentConfigId}
          class="min-h-[44px] rounded-lg border border-border text-destructive disabled:opacity-50"
        >
          Delete
        </button>
        <button
          onclick={launchConfig}
          disabled={!isValid}
          class="min-h-[44px] rounded-lg bg-accent-admin text-text-primary font-bold disabled:opacity-50"
        >
          Launch
        </button>
      </div>
    </section>

    {#if pageError}
      <div class="bg-bg border border-red-500 rounded-xl px-4 py-3 text-[14px] text-red-400 mb-6">
        {pageError}
      </div>
    {/if}

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
          <label for="scavenger-clue-{i}" class="block text-[14px] text-text-secondary mb-1">{m.admin_setup_scavenger_clue_label()}</label>
          <textarea
            id="scavenger-clue-{i}"
            rows="3"
            placeholder={m.admin_setup_scavenger_clue_placeholder()}
            class="w-full bg-bg border border-border rounded-lg px-4 py-2 text-base text-text-primary resize-none"
            value={chapter.scavengerClue}
            oninput={(e) => updateChapterField(i, "scavengerClue", (e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </div>

        <!-- Scavenger hint (optional) -->
        <div class="mb-4">
          <label for="scavenger-hint-{i}" class="block text-[14px] text-text-secondary mb-1">{m.admin_setup_hint_label()}</label>
          <input
            id="scavenger-hint-{i}"
            type="text"
            placeholder={m.admin_setup_hint_placeholder()}
            class="w-full bg-bg border border-border rounded-lg px-4 py-2 text-base text-text-primary"
            value={chapter.scavengerHint ?? ""}
            oninput={(e) => updateChapterField(i, "scavengerHint", (e.target as HTMLInputElement).value)}
          />
        </div>

        <!-- Reward -->
        <div>
          <label for="chapter-reward-{i}" class="block text-[14px] text-text-secondary mb-1">{m.admin_setup_reward_label()}</label>
          <textarea
            id="chapter-reward-{i}"
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

    <!-- Milestones section -->
    <section class="mb-8">
      <h2 class="text-[24px] font-bold text-text-primary mb-2">{m.admin_setup_milestones_section_title()}</h2>
      <p class="text-[14px] text-text-secondary mb-4">{m.admin_setup_milestones_section_body()}</p>

      {#each milestones as milestone, i}
        <div class="bg-surface border border-border rounded-xl p-4 mb-3 flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-[14px] text-text-secondary">{m.admin_setup_milestone_label({ number: i + 1 })}</span>
            <button
              onclick={() => removeMilestone(i)}
              class="text-[14px] text-destructive min-h-[44px] px-2"
            >
              {m.admin_setup_remove_milestone_btn()}
            </button>
          </div>

          <label class="text-[14px] text-text-secondary" for="milestone-points-{milestone.id}">{m.admin_setup_milestone_points_label()}</label>
          <input
            id="milestone-points-{milestone.id}"
            type="number"
            min="1"
            class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-base text-text-primary"
            value={milestone.points}
            oninput={(e) => updateMilestone(i, "points", Number((e.target as HTMLInputElement).value) || 0)}
          />

          <label class="text-[14px] text-text-secondary" for="milestone-reward-{milestone.id}">{m.admin_setup_milestone_reward_label()}</label>
          <textarea
            id="milestone-reward-{milestone.id}"
            rows="2"
            placeholder={m.admin_setup_milestone_reward_placeholder()}
            class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-base text-text-primary resize-none"
            value={milestone.reward}
            oninput={(e) => updateMilestone(i, "reward", (e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </div>
      {/each}

      <button
        onclick={addMilestone}
        class="w-full border border-accent-admin text-accent-admin min-h-[44px] rounded-xl text-[14px]"
      >
        {m.admin_setup_add_milestone_btn()}
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
      <button
        onclick={launchConfig}
        disabled={!isValid}
        class="flex-1 min-h-[48px] bg-text-primary text-bg font-bold rounded-xl disabled:opacity-50 disabled:pointer-events-none"
      >
        Launch
      </button>
    {/if}
  </div>
{/if}
