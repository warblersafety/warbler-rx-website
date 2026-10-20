import { Conversation } from '@elevenlabs/client';
import './demo.css';
import './workflow.css';
import { initVoiceDemo } from './voice-controller.js';
import { initWorkflow } from './workflow-controller.js';

// Load the SDK before interaction so its iOS audio-unlock listener sees the click.
const workflow = initWorkflow();
initVoiceDemo({ loadConversation: () => ({ Conversation }), onWorkflowEvent: workflow.onVoiceEvent });

// Keep the design's policy links usable without leaving an active conversation.
document.querySelectorAll('[data-policy]').forEach(link => {
  link.addEventListener('click', event => {
    const dialog = document.getElementById(link.dataset.policy);
    if (!dialog) return;
    event.preventDefault();
    dialog.showModal();
  });
});
