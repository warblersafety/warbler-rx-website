import { Conversation } from '@elevenlabs/client';
import './demo.css';
import './workflow.css';
import './walkthrough.css';
import './site.css';
import { initWalkthrough } from './walkthrough.js';
import { initVoiceDemo } from './voice-controller.js';
import { initWorkflow } from './workflow-controller.js';

// Load the SDK before interaction so its iOS audio-unlock listener sees the click.
const workflow = initWorkflow();
initWalkthrough();
if (import.meta.env.DEV) {
  // Local design reviews use the existing hosted voice demo, which has the
  // required server endpoints. Production retains the embedded voice session.
  const note = document.createElement('p');
  note.className = 'preview-notice';
  note.textContent = 'Preview: opens the current live voice demo.';
  document.getElementById('try-warbler').append(note);
  document.querySelectorAll('[data-start-demo]').forEach(button => {
    button.addEventListener('click', () => window.open('https://warbler-health.com/#demo', '_blank', 'noopener,noreferrer'));
  });
} else {
  initVoiceDemo({
    loadConversation: () => ({ Conversation }),
    onWorkflowEvent(event) {
      workflow.onVoiceEvent(event);
      if (event.type === 'analyzing' || event.type === 'result') {
        document.getElementById('workflow-details').open = true;
      }
    },
  });
}

// Keep the design's policy links usable without leaving an active conversation.
document.querySelectorAll('[data-policy]').forEach(link => {
  link.addEventListener('click', event => {
    const dialog = document.getElementById(link.dataset.policy);
    if (!dialog) return;
    event.preventDefault();
    dialog.showModal();
  });
});
