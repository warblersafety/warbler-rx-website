import { Conversation } from '@elevenlabs/client';
import './demo.css';
import { initVoiceDemo } from './voice-controller.js';

// Load the SDK before interaction so its iOS audio-unlock listener sees the click.
initVoiceDemo({ loadConversation: () => ({ Conversation }) });

// Keep the design's policy links usable without leaving an active conversation.
document.querySelectorAll('[data-policy]').forEach(link => {
  link.addEventListener('click', event => {
    const dialog = document.getElementById(link.dataset.policy);
    if (!dialog) return;
    event.preventDefault();
    dialog.showModal();
  });
});
