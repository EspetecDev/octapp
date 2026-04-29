<script lang="ts">
  import { locale, setLocale, type SupportedLocale } from '$lib/i18n/locale.svelte.ts';

  const LOCALES: { code: SupportedLocale; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'ca', label: 'Català' },
    { code: 'es', label: 'Español' },
  ];
</script>

<div class="flex gap-2" role="group" aria-label="Language">
  {#each LOCALES as { code, label }}
    <button
      type="button"
      class="
        flex-1 rounded-full px-3 text-sm font-medium transition-all duration-150
        min-h-[44px] cursor-pointer
        {locale.current === code
          ? 'bg-text-primary text-bg border-2 border-text-primary'
          : 'bg-surface border-2 border-border text-text-secondary hover:text-text-primary'}
      "
      onclick={() => setLocale(code)}
      aria-pressed={locale.current === code}
    >
      {label}
    </button>
  {/each}
</div>
