<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import {
    MessageSquareIcon,
    PlusCircleIcon,
    SettingsIcon,
    WifiIcon,
  } from "svelte-feather-icons";

  import logo from "$lib/assets/logo.svg";

  export let connected: boolean;
  export let hasWriteAccess: boolean | undefined;
  export let newMessages: boolean;

  const dispatch = createEventDispatcher<{
    create: void;
    chat: void;
    settings: void;
    networkInfo: void;
    exportPlain: void;
    exportHtml: void;
    metadata: void;
  }>();
</script>

<div class="panel inline-block px-3 py-2">
  <div class="flex items-center select-none">
    <a href="/" class="flex-shrink-0"
      ><img src={logo} alt="sshx logo" class="h-10" /></a
    >
    <p class="ml-1.5 mr-2 font-medium">sshx</p>

    <div class="v-divider" />

    <div class="flex space-x-1">
      <button
        class="icon-button"
        on:click={() => dispatch("create")}
        disabled={!connected || !hasWriteAccess}
        title={!connected
          ? "Not connected"
          : hasWriteAccess === false
          ? "No write access"
          : "Create new terminal"}
      >
        <PlusCircleIcon strokeWidth={1.5} class="p-0.5" />
      </button>
      <button class="icon-button" on:click={() => dispatch("chat")}>
        <MessageSquareIcon strokeWidth={1.5} class="p-0.5" />
        {#if newMessages}
          <div class="activity" />
        {/if}
      </button>
      <button class="icon-button" on:click={() => dispatch("settings")}>
        <SettingsIcon strokeWidth={1.5} class="p-0.5" />
      </button>
    </div>

    <div class="v-divider" />

    <div class="flex space-x-1">
      <button class="icon-button" on:click={() => dispatch("networkInfo")}>
        <WifiIcon strokeWidth={1.5} class="p-0.5" />
      </button>
      <!-- Export dropdown -->
      <div class="relative group">
        <button class="icon-button text-xs font-bold" title="Export terminal output">
          ⬇
        </button>
        <div
          class="absolute top-full right-0 mt-1 hidden group-hover:block group-focus-within:block bg-zinc-800 rounded-lg shadow-lg border border-zinc-700 py-1 min-w-[160px] z-50"
        >
          <button
            class="block w-full text-left px-4 py-2 text-sm hover:bg-zinc-700 transition-colors"
            on:click={() => dispatch("exportPlain")}
          >
            Export as plain text
          </button>
          <button
            class="block w-full text-left px-4 py-2 text-sm hover:bg-zinc-700 transition-colors"
            on:click={() => dispatch("exportHtml")}
          >
            Export as HTML (ANSI preserved)
          </button>
        </div>
      </div>
      <button class="icon-button text-xs font-bold" on:click={() => dispatch("metadata")} title="Session metadata (local only)">
        🏷
      </button>
    </div>
  </div>
</div>

<style lang="postcss">
  .v-divider {
    @apply h-5 mx-2 border-l-4 border-zinc-800;
  }

  .icon-button {
    @apply relative rounded-md p-1 hover:bg-zinc-700 active:bg-indigo-700 transition-colors;
    @apply disabled:opacity-50 disabled:bg-transparent;
  }

  .activity {
    @apply absolute top-1 right-0.5 text-xs p-[4.5px] bg-red-500 rounded-full;
  }
</style>
