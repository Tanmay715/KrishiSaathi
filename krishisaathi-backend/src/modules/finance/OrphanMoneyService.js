const db = require('../../db/connection');

class OrphanMoneyService {
  async linkOrphanRecords(user_id) {
    const expense_count = await this.#linkOrphanTable(user_id, 'farm_expenses', 'expense_date');
    const income_count = await this.#linkOrphanTable(user_id, 'farm_incomes', 'income_date');

    return {
      expenses_linked: expense_count,
      incomes_linked: income_count,
      total_linked: expense_count + income_count,
    };
  }

  async #linkOrphanTable(user_id, table_name, date_field) {
    const orphans = await db(table_name)
      .where({ user_id })
      .whereNull('crop_cycle_id')
      .whereNotNull('plot_id');

    if (!orphans.length) {
      return 0;
    }

    const plot_ids = [...new Set(orphans.map((row) => row.plot_id))];
    const crops = await db('crop_cycles')
      .whereIn('plot_id', plot_ids)
      .orderBy('sowing_date', 'desc')
      .orderBy('created_at', 'desc');

    const crops_by_plot = {};
    crops.forEach((crop) => {
      if (!crops_by_plot[crop.plot_id]) {
        crops_by_plot[crop.plot_id] = [];
      }
      crops_by_plot[crop.plot_id].push(crop);
    });

    let linked_count = 0;

    for (const row of orphans) {
      const crop_id = this.#matchCropForDate(crops_by_plot[row.plot_id] || [], row[date_field]);
      if (!crop_id) {
        continue;
      }

      await db(table_name).where({ id: row.id }).update({ crop_cycle_id: crop_id });
      linked_count += 1;
    }

    return linked_count;
  }

  #matchCropForDate(crops, transaction_date) {
    if (!crops.length || !transaction_date) {
      return null;
    }

    const tx_date = new Date(transaction_date);
    if (Number.isNaN(tx_date.getTime())) {
      return null;
    }

    for (const crop of crops) {
      if (this.#isDateInCropRange(tx_date, crop)) {
        return crop.id;
      }
    }

    const before_crop = crops.find((crop) => {
      const start = this.#getCropStart(crop);
      return start && tx_date >= start;
    });

    return before_crop?.id || crops[0]?.id || null;
  }

  #isDateInCropRange(tx_date, crop) {
    const start = this.#getCropStart(crop);
    const end = this.#getCropEnd(crop);
    if (!start) {
      return false;
    }
    return tx_date >= start && tx_date <= end;
  }

  #getCropStart(crop) {
    const value = crop.sowing_date || crop.created_at;
    return value ? new Date(value) : null;
  }

  #getCropEnd(crop) {
    if (crop.actual_harvest_date) {
      return new Date(crop.actual_harvest_date);
    }
    if (crop.expected_harvest_date) {
      return new Date(crop.expected_harvest_date);
    }
    if (['planned', 'active'].includes(crop.status)) {
      return new Date();
    }
    return this.#getCropStart(crop);
  }
}

module.exports = new OrphanMoneyService();
