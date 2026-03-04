/**
 * Shared "About This View" renderer for GDS ecosystem notes.
 *
 * Each showcase page calls this once after rendering to append
 * a styled aside explaining how the GDS ecosystem enables that view.
 */

const SHARED_CLOSING =
  'The GDS ecosystem separates rich representations from visualization — ' +
  'one model, many views, none compromised. Domain IR, GDSSpec, and SystemIR ' +
  'each remain authoritative for their concerns; views consume whichever is relevant.';

/**
 * Render an ecosystem note at the end of a container.
 *
 * @param {HTMLElement} container - DOM element to append the note to
 * @param {Object} opts
 * @param {string} opts.view    - Name of this page/view
 * @param {string} opts.source  - Which GDS representation(s) this page draws from
 * @param {string} opts.question - What this view answers
 * @param {string} opts.note    - Page-specific note (3-4 sentences)
 */
export function renderEcosystemNote(container, { view, source, question, note }) {
  const aside = document.createElement('aside');
  aside.className = 'ecosystem-note';
  aside.innerHTML = `
    <h3>About This View</h3>
    <p><strong>Source:</strong> ${source}</p>
    <p><strong>Question:</strong> ${question}</p>
    <p>${note}</p>
    <p class="ecosystem-closing">${SHARED_CLOSING}</p>
  `;
  container.appendChild(aside);
}
