const db = require('../../db/connection');

class CropTemplateService {
  async listTemplates(language = 'en') {
    const templates = await db('crop_templates')
      .where({ is_active: true })
      .orderBy('name_en', 'asc');

    return templates.map((template) => this.#formatTemplate(template, language));
  }

  #formatTemplate(template, language) {
    const name = language === 'hi' ? template.name_hi : template.name_en;
    let default_stages = template.default_stages;

    if (typeof default_stages === 'string') {
      default_stages = JSON.parse(default_stages);
    }

    return {
      id: template.id,
      name,
      name_en: template.name_en,
      name_hi: template.name_hi,
      category: template.category,
      default_stages: default_stages || [],
    };
  }
}

module.exports = new CropTemplateService();
