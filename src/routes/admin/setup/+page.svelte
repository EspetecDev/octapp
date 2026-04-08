<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { gameState, sendMessage } from "$lib/socket.ts";
  import type { Chapter, TriviaQuestion, PowerUp } from "$lib/types.ts";

  // Auth state (identical pattern to /admin)
  let authorized = $state<boolean | null>(null); // null = loading
  let token = $state<string>(""); // stored for link preservation (Pitfall 3)

  // Form state
  let chapters = $state<Chapter[]>([]);
  let powerUpCatalog = $state<PowerUp[]>([]);
  let saveFlash = $state(false);
  let saveFlashTimer: ReturnType<typeof setTimeout> | null = null;

  // Restore guard — only restore once from server state
  let restoredFromState = $state(false);

  // Restore form from $gameState on first sync (ADMN-05)
  $effect(() => {
    const gs = $gameState;
    if (!restoredFromState && gs && gs.chapters.length > 0) {
      chapters = structuredClone(gs.chapters);
      powerUpCatalog = structuredClone(gs.powerUpCatalog);
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
    sendMessage({ type: "SAVE_SETUP", chapters, powerUpCatalog });
    saveFlash = true;
    if (saveFlashTimer) clearTimeout(saveFlashTimer);
    saveFlashTimer = setTimeout(() => {
      saveFlash = false;
    }, 1500);
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
    <p class="text-[24px] font-bold text-text-primary">Access denied.</p>
  </main>

{:else}
  <!-- Authorized: pre-event setup form -->
  <main class="min-h-[100dvh] bg-bg px-4 pb-32">

    <!-- Page header -->
    <header class="pt-6 pb-4 flex items-center justify-between">
      <h1 class="text-[24px] font-bold text-text-primary">Configure Game</h1>
      <a href="/admin?token={token}" class="text-[14px] text-text-secondary">Back to Dashboard</a>
    </header>

    <!-- Chapters empty state -->
    {#if chapters.length === 0}
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <p class="text-[24px] font-bold text-text-primary mb-2">No chapters yet</p>
        <p class="text-base text-text-secondary">Add your first chapter to get started.</p>
      </div>
    {/if}

    <!-- Chapter blocks -->
    {#each chapters as chapter, i}
      <section class="bg-surface rounded-xl border border-border p-6 mb-6">

        <!-- Chapter header -->
        <div class="flex items-center mb-4">
          <span class="text-[14px] text-text-secondary">Chapter {i + 1}</span>
          <button
            onclick={() => removeChapter(i)}
            class="ml-auto text-[14px] text-destructive min-h-[44px] px-2"
          >
            Remove Chapter
          </button>
        </div>

        <!-- Chapter name -->
        <div class="mb-4">
          <input
            type="text"
            placeholder="Chapter name (e.g. The Bar)"
            class="w-full bg-bg border border-border rounded-lg px-4 py-2 text-[24px] font-bold text-text-primary"
            value={chapter.name}
            oninput={(e) => updateChapterField(i, "name", (e.target as HTMLInputElement).value)}
          />
        </div>

        <!-- Minigame type selector -->
        <div class="flex gap-2 mb-4">
          {#each (["trivia", "sensor", "memory"] as const) as type}
            <button
              onclick={() => updateChapterField(i, "minigameType", type)}
              class="min-h-[44px] px-4 rounded-lg {chapter.minigameType === type
                ? 'border-2 border-accent-admin text-text-primary bg-surface'
                : 'border border-border text-text-secondary'}"
            >
              {type === "trivia" ? "Trivia" : type === "sensor" ? "Sensor" : "Memory"}
            </button>
          {/each}
        </div>

        <!-- Trivia pool (only when type is trivia) -->
        {#if chapter.minigameType === "trivia"}
          <div class="mb-4">
            <p class="text-[14px] text-text-secondary mb-2">Trivia Questions</p>

            {#each chapter.triviaPool as question, qi}
              <div class="bg-bg border border-border rounded-lg p-4 mb-3">
                <div class="flex items-start justify-between mb-2">
                  <span class="text-[14px] text-text-secondary">Question {qi + 1}</span>
                  <button
                    onclick={() => removeQuestion(i, qi)}
                    class="text-[14px] text-destructive min-h-[44px] px-2"
                  >
                    Remove
                  </button>
                </div>

                <!-- Question text -->
                <textarea
                  rows="1"
                  placeholder="Question text"
                  class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-base text-text-primary mb-2 resize-none"
                  value={question.question}
                  oninput={(e) => updateQuestion(i, qi, "question", (e.target as HTMLTextAreaElement).value)}
                ></textarea>

                <!-- Correct answer -->
                <input
                  type="text"
                  placeholder="Correct answer"
                  class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-base text-text-primary mb-2"
                  value={question.correctAnswer}
                  oninput={(e) => updateQuestion(i, qi, "correctAnswer", (e.target as HTMLInputElement).value)}
                />

                <!-- Wrong options -->
                <input
                  type="text"
                  placeholder="Wrong option 1"
                  class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-base text-text-primary mb-2"
                  value={question.wrongOptions[0]}
                  oninput={(e) => updateWrongOption(i, qi, 0, (e.target as HTMLInputElement).value)}
                />
                <input
                  type="text"
                  placeholder="Wrong option 2"
                  class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-base text-text-primary mb-2"
                  value={question.wrongOptions[1]}
                  oninput={(e) => updateWrongOption(i, qi, 1, (e.target as HTMLInputElement).value)}
                />
                <input
                  type="text"
                  placeholder="Wrong option 3"
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
              + Add Question
            </button>
          </div>
        {/if}

        <!-- Scavenger clue -->
        <div class="mb-4">
          <label class="block text-[14px] text-text-secondary mb-1">Scavenger Clue</label>
          <textarea
            rows="3"
            placeholder="Riddle or clue directing the groom where to go"
            class="w-full bg-bg border border-border rounded-lg px-4 py-2 text-base text-text-primary resize-none"
            value={chapter.scavengerClue}
            oninput={(e) => updateChapterField(i, "scavengerClue", (e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </div>

        <!-- Scavenger hint (optional) -->
        <div class="mb-4">
          <label class="block text-[14px] text-text-secondary mb-1">Hint (optional)</label>
          <input
            type="text"
            placeholder="Optional hint (costs points to reveal)"
            class="w-full bg-bg border border-border rounded-lg px-4 py-2 text-base text-text-primary"
            value={chapter.scavengerHint ?? ""}
            oninput={(e) => updateChapterField(i, "scavengerHint", (e.target as HTMLInputElement).value)}
          />
        </div>

        <!-- Reward -->
        <div>
          <label class="block text-[14px] text-text-secondary mb-1">Reward</label>
          <textarea
            rows="2"
            placeholder="What is unlocked (dare, location, embarrassing content)"
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
      + Add Chapter
    </button>

    <!-- Power-ups & Sabotages section -->
    <section class="mb-8">
      <h2 class="text-[24px] font-bold text-text-primary mb-4">Power-ups & Sabotages</h2>

      {#each powerUpCatalog as powerUp, i}
        <div class="bg-surface border border-border rounded-xl p-4 mb-3 flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-[14px] text-text-secondary">Entry {i + 1}</span>
            <button
              onclick={() => removePowerUp(i)}
              class="text-[14px] text-destructive min-h-[44px] px-2"
            >
              Remove
            </button>
          </div>

          <!-- Name -->
          <input
            type="text"
            placeholder="Power-up name"
            class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-base text-text-primary"
            value={powerUp.name}
            oninput={(e) => updatePowerUp(i, "name", (e.target as HTMLInputElement).value)}
          />

          <!-- Description -->
          <input
            type="text"
            placeholder="Description"
            class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-base text-text-primary"
            value={powerUp.description}
            oninput={(e) => updatePowerUp(i, "description", (e.target as HTMLInputElement).value)}
          />

          <div class="flex items-center gap-3">
            <!-- Token cost -->
            <div class="flex items-center gap-2">
              <label class="text-[14px] text-text-secondary">Cost</label>
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
              <label class="text-[14px] text-text-secondary">Effect</label>
              <select
                class="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-base text-text-primary min-h-[44px]"
                value={powerUp.effectType}
                onchange={(e) => updatePowerUp(i, "effectType", (e.target as HTMLSelectElement).value)}
              >
                <option value="timer_add">Timer Add</option>
                <option value="scramble_options">Scramble Options</option>
                <option value="distraction">Distraction</option>
              </select>
            </div>
          </div>
        </div>
      {/each}

      <button
        onclick={addPowerUp}
        class="w-full border border-accent-admin text-accent-admin min-h-[44px] rounded-xl text-[14px]"
      >
        + Add Power-up
      </button>
    </section>

  </main>

  <!-- Sticky save button -->
  <div class="fixed bottom-0 left-0 right-0 bg-bg pb-6 px-4 pt-2">
    <button
      onclick={saveSetup}
      disabled={!isValid}
      class="w-full min-h-[48px] bg-accent-admin text-text-primary font-bold rounded-xl disabled:opacity-50 disabled:pointer-events-none"
      style={saveFlash ? "background: #22c55e;" : ""}
    >
      {saveFlash ? "Saved" : "Save Setup"}
    </button>
  </div>
{/if}
