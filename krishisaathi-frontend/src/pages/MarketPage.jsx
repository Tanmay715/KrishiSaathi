import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MandiMarketSection from '../components/MandiMarketSection';
import PageHeader from '../components/PageHeader';
import { getFarms, getPendingIncomeCrops } from '../services/farm_service';

function MarketPage() {
  const { t } = useTranslation();
  const [search_params] = useSearchParams();
  const [farm_id, setFarmId] = useState(null);
  const [preferred_crops, setPreferredCrops] = useState([]);

  useEffect(() => {
    let is_cancelled = false;

    async function loadContext() {
      try {
        const [farms_response, pending_response] = await Promise.all([
          getFarms(),
          getPendingIncomeCrops(),
        ]);
        if (is_cancelled) {
          return;
        }
        setFarmId(farms_response.data?.[0]?.id || null);
        setPreferredCrops(
          (pending_response.data || []).map((crop) => crop.crop_name || crop.name),
        );
      } catch (error) {
        console.error(error);
      }
    }

    loadContext();
    return () => {
      is_cancelled = true;
    };
  }, []);

  return (
    <div className="market-page page-stack">
      <PageHeader
        title={t('mandi.board_title')}
        subtitle={t('mandi.nearby_rates')}
      />
      <MandiMarketSection
        layout="page"
        farm_id={farm_id}
        preferred_crops={preferred_crops}
        initial_crop={search_params.get('crop')}
      />
    </div>
  );
}

export default MarketPage;
