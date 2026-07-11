const { join } = require('path');

/**
 * Fa sì che Puppeteer scarichi (in fase di build) e cerchi (a runtime) Chromium
 * dentro la cartella del progetto backend, invece di ~/.cache/puppeteer.
 * Su Render la home cache NON persiste dal build al runtime: senza questo file
 * si ottiene "Could not find Chrome" quando si genera un PDF. Con questo file
 * Chromium sta in backend/.cache/puppeteer, che fa parte dei file distribuiti.
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
