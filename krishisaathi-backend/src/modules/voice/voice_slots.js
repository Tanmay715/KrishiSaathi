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
  create_farm: {
    required: ['name', 'total_area'],
    questions: {
      name: {
        en: 'What should we name this farm?',
        hi: 'इस खेत का क्या नाम रखें?',
      },
      total_area: {
        en: 'How much total area is this farm?',
        hi: 'इस खेत का कुल क्षेत्रफल कितना है?',
      },
    },
  },
  create_plot: {
    required: ['name', 'area', 'farm_id'],
    questions: {
      name: {
        en: 'What is the plot name?',
        hi: 'प्लॉट का क्या नाम है?',
      },
      area: {
        en: 'How much area is this plot?',
        hi: 'इस प्लॉट का क्षेत्रफल कितना है?',
      },
      farm_id: {
        en: 'Which farm should this plot belong to?',
        hi: 'यह प्लॉट किस खेत में जोड़ना है?',
      },
    },
  },
};

const UNKNOWN_PROMPT = {
  en: 'Sorry, I did not understand. Here is what I can help with — tap one or just speak.',
  hi: 'माफ़ करें, मैं समझ नहीं पाया। मैं इनमें मदद कर सकता हूँ — किसी को चुनें या बोलें।',
};

const HELP_TEXT = {
  en: 'I am Fasalya, your farm companion. Say things like "spent 800 on urea", "add a farm in Meerut", '
    + '"how much on diesel in July", or "remind me to irrigate Monday". I keep it short and useful.',
  hi: 'मैं फसल्या हूँ — आपका खेती साथी। जैसे बोलें: "खाद पर आठ सौ खर्च", "मेरठ में नया खेत जोड़ो", '
    + '"जुलाई में डीजल पर कितना खर्च", या "सोमवार को सिंचाई याद दिलाना"। कम बात, ज़्यादा मदद।',
};

const ASSISTANT_ERROR = {
  en: 'I could not reach the farm assistant right now. Please try again shortly.',
  hi: 'अभी खेती सहायक से बात नहीं हो पाई। थोड़ी देर बाद फिर कोशिश करें।',
};

const ASSISTANT_LIMIT = {
  en: 'You have asked a lot of questions this hour. Please try again a little later.',
  hi: 'इस घंटे में बहुत सवाल पूछ लिए। थोड़ी देर बाद फिर पूछें।',
};

const DEFAULT_SUGGESTIONS = ['expense', 'income', 'reminder', 'assistant'];

/** Suggestion chips change with the screen the farmer is on. */
function suggestionsForContext(context = {}) {
  const page = context.page;

  if (page === 'farms') {
    return ['create_farm', 'expense', 'assistant', 'reminder'];
  }

  if (page === 'farm') {
    return ['create_plot', 'expense', 'income', 'assistant'];
  }

  if (page === 'plot') {
    return ['expense', 'income', 'reminder', 'assistant'];
  }

  if (page === 'assistant') {
    return ['assistant', 'expense', 'income', 'reminder'];
  }

  if (page === 'money') {
    return ['expense', 'income', 'reminder', 'assistant'];
  }

  return DEFAULT_SUGGESTIONS;
}

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
  suggestionsForContext,
  missingSlots,
  slotQuestion,
  unknownPrompt,
  helpText,
  assistantErrorText,
};
