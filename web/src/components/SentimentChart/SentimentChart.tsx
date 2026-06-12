import { useIsDark } from '../../hooks/useIsDark';
import { Line } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Legend
} from 'chart.js';
import type { ChartOptions } from 'chart.js';
import type { SentimentResult } from '../../services/sentimentAnalysis';
import './SentimentChart.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Legend
);

interface SentimentChartProps {
  sentimentResults: SentimentResult[];
}

const sentimentValueMap: Record<string, number> = {
  Negative: -1.0,
  Neutral: 0,
  Positive: 1.0,
};

const SentimentChart: React.FC<SentimentChartProps> = ({ sentimentResults }) => {
  const { t } = useTranslation();
  const isDark = useIsDark();

  if (!sentimentResults || sentimentResults.length === 0) {
    return <p>{t('sentiment.noResults')}</p>;
  }

  const labels = sentimentResults.map((_, i) => {
    if (i === 0) return t('sentiment.xAxis.start');
    if (i === sentimentResults.length - 1) return t('sentiment.xAxis.end');
    return '';
  });
  const sentimentValues = sentimentResults.map(result => sentimentValueMap[result.sentiment] || 0);

  const chartData = {
    labels,
    datasets: [
      {
        label: t('sentiment.title'),
        data: sentimentValues,
        borderColor: '#A78BFA',
        backgroundColor: 'rgba(167, 139, 250, 0.5)',
        yAxisID: 'y',
        cubicInterpolationMode: 'monotone' as const,
        pointRadius: 0,
        pointHoverRadius: 0,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: true,
    layout: {
      padding: { top: 10, bottom: 10 },
    },
    events: [],
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
    scales: {
      x: {
        display: true,
        ticks: {
          color: isDark ? 'rgba(255, 255, 255, 0.55)' : '#2c4a5c',
          autoSkip: false,
          maxRotation: 0,
        },
        grid: { display: false },
        border: {
          display: true,
          color: isDark ? 'rgba(255, 255, 255, 0.3)' : '#3a5a6e',
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        min: -1.3,
        max: 1.3,
        ticks: {
          color: isDark ? 'rgba(255, 255, 255, 0.55)' : '#2c4a5c',
          callback: (value) => t(`sentiment.labels.${value}`, { defaultValue: '' })
        },
        grid: { display: false },
        border: {
          display: true,
          color: isDark ? 'rgba(255, 255, 255, 0.3)' : '#3a5a6e',
        },
      },
    },
  };

  return (
    <div className="sentiment-chart-container">
      <Line options={options} data={chartData} />
    </div>
  );
};

export default SentimentChart;
