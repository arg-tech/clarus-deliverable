import { Line } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend
} from 'chart.js';
import type { ChartOptions } from 'chart.js';
import type { SentimentResult } from '../../services/sentimentAnalysis';
import './SentimentChart.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface SentimentChartProps {
  sentimentResults: SentimentResult[];
}

// Map sentiment strings to numeric values for charting
const sentimentValueMap: Record<string, number> = {
  'Very Negative': -2.0,
  'Negative': -1.0,
  'Neutral': 0,
  'Positive': 1.0,
  'Very Positive': 2.0
};

const SentimentChart: React.FC<SentimentChartProps> = ({ sentimentResults }) => {
  const { t } = useTranslation();
  
  if (!sentimentResults || sentimentResults.length === 0) {
    return <p>{t('sentiment.noResults')}</p>;
  }

  // Process data for chart
  const labels = Array(sentimentResults.length).fill(''); // Empty labels
  const sentimentValues = sentimentResults.map(result => sentimentValueMap[result.sentiment] || 0);

  // Define chart data
  const chartData = {
    labels,
    datasets: [
      {
        label: t('sentiment.title'),
        data: sentimentValues,
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        yAxisID: 'y',
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: t('sentiment.title'),
      },
      tooltip: {
        callbacks: {
          title: (context) => {
            const idx = context[0].dataIndex;
            return sentimentResults[idx]?.sentence || '';
          },
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            
            if (label === 'Sentiment Value') {
              // Convert numeric value back to sentiment label
              const actualSentiment = sentimentResults[context.dataIndex]?.sentiment;
              return `${label}: ${actualSentiment} (${value})`;
            }
            
            return `${label}: ${value.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: false, // Hide the x-axis completely
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        min: -2,
        max: 2,
        ticks: {
          callback: (value) => t(`sentiment.labels.${value}`, { defaultValue: '' })
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
