/**
 * Slot definitions for spoken commands. A farmer rarely says everything in one
 * sentence, so each intent declares what it still needs and the exact question to ask
 * back — in Hindi or English — until the record can be created.
 */
const INTENT_SLOTS = {
  expense: {
    required: ['amount', 'title'],
    questions: {
      amount: {
        en: 'How much did you spend?',
        hi: 'कितने रुपये खर्च हुए?',
      },
      title: {
        en: 'What did you spend it on?',
        hi: 'किस चीज़ पर खर्च हुआ?',
      },
    },
  },
  income: {
    required: ['amount', 'title'],
    questions: {
      amount: {
        en: 'How much did you receive?',
        hi: 'कितने रुपये मिले?',
      },
      title: {
        en: 'What did you sell?',
        hi: 'क्या बेचा?',
      },
    },
  },
  reminder: {
    required: ['title', 'due_at'],
    questions: {
      title: {
        en: 'What should I remind you about?',
        hi: 'किस काम की याद दिलाऊँ?',
      },
      due_at: {
        en: 'Which day should I remind you?',
        hi: 'किस दिन याद दिलाऊँ?',
      },
    },
  },
};

const UNKNOWN_PROMPT = {
  en: 'I did not catch that. Try saying: spent 800 rupees on urea.',
  hi: 'समझ नहीं आया। ऐसे बोलें: खाद पर आठ सौ रुपये खर्च हुए।',
};

function missingSlots(intent, draft = {}) {
  const config = INTENT_SLOTS[intent];

  if (!config) {
    return [];
  }

  return config.required.filter((slot) => isEmptySlot(draft[slot]));
}

function slotQuestion(intent, slot, language) {
  const question = INTENT_SLOTS[intent]?.questions?.[slot];

  if (!question) {
    return unknownPrompt(language);
  }

  return language === 'hi' ? question.hi : question.en;
}

function unknownPrompt(language) {
  return language === 'hi' ? UNKNOWN_PROMPT.hi : UNKNOWN_PROMPT.en;
}

function isEmptySlot(value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'number') {
    return !(value > 0);
  }

  return String(value).trim() === '';
}

module.exports = {
  INTENT_SLOTS,
  missingSlots,
  slotQuestion,
  unknownPrompt,
};
