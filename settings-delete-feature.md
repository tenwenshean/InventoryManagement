# Implementation Plan

The issue was that when I added the handleDeleteAccountData function, I was checking `if (response.ok)` but the apiRequest function already throws on error, so this created an unnecessary nesting level that confused the TypeScript parser.

The fix is to not check response.ok since apiRequest will throw if there's an error.

I'll now apply the changes step by step to avoid parser errors.
