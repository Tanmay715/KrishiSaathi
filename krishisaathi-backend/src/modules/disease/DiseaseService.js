const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../../db/connection');
const ApiError = require('../../utils/ApiError');
const { getOpenAiClient, getOpenAiModel } = require('../../lib/openai_client');
const { assertRateLimit } = require('../../utils/rate_limit');
require('../../middleware/upload');

class DiseaseService {
  async listScans(user_id, farm_id) {
    await this.#ensureFarm(user_id, farm_id);

    const rows = await db('disease_scans')
      .where({ user_id, farm_id })
      .orderBy('created_at', 'desc')
      .limit(50);

    return rows.map((row) => this.#formatScan(row));
  }

  async getScan(user_id, farm_id, scan_id) {
    const scan = await db('disease_scans').where({ id: scan_id, user_id, farm_id }).first();

    if (!scan) {
      throw ApiError.notFound('Disease scan not found');
    }

    return this.#formatScan(scan);
  }

  async createScan(user_id, farm_id, file, { plot_id = null, crop_cycle_id = null }) {
    await this.#ensureFarm(user_id, farm_id);
    await assertRateLimit({
      key: `disease_scan:${user_id}`,
      limit: 10,
      window_seconds: 86400,
      message: 'Disease scan daily limit reached.',
    });

    if (!file) {
      throw ApiError.badRequest('Image file is required');
    }

    let crop_name = null;
    let crop_stage = null;

    if (crop_cycle_id && plot_id) {
      const cycle = await db('crop_cycles')
        .join('plots', 'crop_cycles.plot_id', 'plots.id')
        .where('crop_cycles.id', crop_cycle_id)
        .where('plots.farm_id', farm_id)
        .select('crop_cycles.*')
        .first();

      if (!cycle) {
        throw ApiError.notFound('Crop cycle not found');
      }

      crop_name = cycle.crop_name;
      const stages = this.#parseStages(cycle.lifecycle_stages);
      crop_stage = stages.find((stage) => !stage.completed)?.name || null;
    }

    const model = getOpenAiModel();
    const diagnosis = await this.#diagnose(file.path, crop_name, crop_stage);
    const scan_id = uuidv4();
    const relative_path = path.join('disease', path.basename(file.path));

    await db('disease_scans').insert({
      id: scan_id,
      user_id,
      farm_id,
      plot_id: plot_id || null,
      crop_cycle_id: crop_cycle_id || null,
      image_path: relative_path,
      status: 'completed',
      diagnosis_json: JSON.stringify(diagnosis),
      confidence: diagnosis.confidence ?? null,
      model,
    });

    return this.getScan(user_id, farm_id, scan_id);
  }

  getImageAbsolutePath(relative_path) {
    const path = require('path');
    const uploads_dir = path.join(__dirname, '..', '..', 'uploads');
    const file_path = path.join(uploads_dir, relative_path);

    if (!fs.existsSync(file_path)) {
      throw ApiError.notFound('Image not found');
    }

    return file_path;
  }

  async #diagnose(file_path, crop_name, crop_stage) {
    const openai = getOpenAiClient();
    const image_b64 = fs.readFileSync(file_path).toString('base64');
    const ext = path.extname(file_path).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    let completion;

    try {
      completion = await openai.chat.completions.create({
        model: getOpenAiModel(),
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: [
              'You are an agronomy assistant for Indian farmers.',
              'Look at the crop leaf image and diagnose likely disease or deficiency.',
              'Return JSON with keys: disease (string), confidence (0-1), explanation (string),',
              'treatment (string of general cultural/IPM steps), products (string array of generic active-ingredient examples only, never brand prescriptions),',
              'prevention (string). Always sound uncertain when image quality is poor.',
              'Never claim certainty. Prefer "possible" language. Tell farmer to confirm with local agri officer / KVK before spraying.',
              crop_name ? `Crop context: ${crop_name}.` : '',
              crop_stage ? `Current stage: ${crop_stage}.` : '',
            ].filter(Boolean).join(' '),
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Diagnose this leaf image.' },
              {
                type: 'image_url',
                image_url: { url: `data:${mime};base64,${image_b64}` },
              },
            ],
          },
        ],
      });
    } catch (error) {
      console.error('[disease] OpenAI error:', error.message);
      throw ApiError.serviceUnavailable('Disease scan could not complete. Try again shortly.');
    }

    let parsed;

    try {
      parsed = JSON.parse(completion.choices?.[0]?.message?.content || '{}');
    } catch (error) {
      throw ApiError.serviceUnavailable('Could not parse disease diagnosis.');
    }

    return {
      disease: parsed.disease || 'Unknown',
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.4)),
      explanation: parsed.explanation || '',
      treatment: parsed.treatment || '',
      products: Array.isArray(parsed.products) ? parsed.products.slice(0, 8) : [],
      prevention: parsed.prevention || '',
    };
  }

  #formatScan(row) {
    let diagnosis = row.diagnosis_json;

    if (typeof diagnosis === 'string') {
      try {
        diagnosis = JSON.parse(diagnosis);
      } catch (error) {
        diagnosis = null;
      }
    }

    return {
      ...row,
      diagnosis_json: diagnosis,
      confidence: row.confidence != null ? Number(row.confidence) : null,
    };
  }

  #parseStages(value) {
    if (!value) {
      return [];
    }

    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        return [];
      }
    }

    return Array.isArray(value) ? value : [];
  }

  async #ensureFarm(user_id, farm_id) {
    const farm = await db('farms').where({ id: farm_id, user_id, is_active: true }).first();

    if (!farm) {
      throw ApiError.notFound('Farm not found');
    }

    return farm;
  }
}

module.exports = new DiseaseService();
