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
  en: 'Sorry, I did not understand. Here is what I can help with — tap one or just speak.',
  hi: 'माफ़ करें, मैं समझ नहीं पाया। मैं इनमें मदद कर सकता हूँ — किसी को चुनें या बोलें।',
};

const HELP_TEXT = {
  en: 'I am your farm companion. Tell me things like "spent 800 on urea", "sold wheat for 20000", '
    + 'or "remind me to irrigate on Monday". You can also ask me any farming question.',
  hi: 'मैं आपका खेती साथी हूँ। मुझसे ऐसे कहें: "खाद पर आठ सौ खर्च हुए", "गेहूँ बीस हज़ार में बेचा", '
    + 'या "सोमवार को सिंचाई की याद दिलाना"। खेती से जुड़ा कोई भी सवाल भी पूछ सकते हैं।',
};

const ASSISTANT_ERROR = {
  en: 'I could not reach the farm assistant right now. Please try again shortly.',
  hi: 'अभी खेती सहायक से बात नहीं हो पाई। थोड़ी देर बाद फिर कोशिश करें।',
};

const ASSISTANT_LIMIT = {
  en: 'You have asked a lot of questions this hour. Please try again a little later.',
  hi: 'इस घंटे में बहुत सवाल पूछ लिए। थोड़ी देर बाद फिर पूछें।',
};

// Options offered whenever the farmer is unsure — the frontend renders these as chips.
const DEFAULT_SUGGESTIONS = ['expense', 'income', 'reminder', 'assistant'];

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
  return pick(UNKNOWN_PROMPT, language);
}

function helpText(language) {
  return pick(HELP_TEXT, language);
}

function assistantErrorText(language, is_rate_limited = false) {
  return pick(is_rate_limited ? ASSISTANT_LIMIT : ASSISTANT_ERROR, language);
}

function pick(messages, language) {
  return language === 'hi' ? messages.hi : messages.en;
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
  DEFAULT_SUGGESTIONS,
  missingSlots,
  slotQuestion,
  unknownPrompt,
  helpText,
  assistantErrorText,
};
