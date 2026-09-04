import 'dotenv/config';
import { generateMealPlan, parseCuisine } from '../src/llmClient.js';
import { createDeliveryManager, deliverPlan } from '../src/delivery.js';
import { sanitizeText, validateCalories, validateProtein, validateTimeFormat, validatePlanName } from '../src/validate.js';

const answers = {
  goal: 'General health',
  restrictions: 'Vegetarian',
  allergies: 'Shellfish',
  calories: '2500',
  mealsPerDay: '4',
  protein: null,
  cuisine: 'Mediterranean',
};

async function main() {
  // Test validation functions
  console.log('=== Validation ===');
  console.log('calories 2500:', validateCalories('2500'));
  console.log('calories 500:', validateCalories('500'));   // should fail
  console.log('calories 6000:', validateCalories('6000')); // should fail
  console.log('protein 150g:', validateProtein('150g'));
  console.log('protein 10g:', validateProtein('10g'));   // should fail
  console.log('time 07:30:', validateTimeFormat('07:30'));
  console.log('time 25:00:', validateTimeFormat('25:00')); // should fail
  console.log('plan name bulking:', validatePlanName('bulking'));
  console.log('plan name with ;:', validatePlanName('test;drop'));
  console.log('sanitize:', sanitizeText('  hello\x00world  '));

  // Test delivery manager (mock telegram)
  console.log('\n=== Delivery ===');
  const mockTelegram = {
    async sendMessage(chatId: number, text: string) {
      console.log(`[mock TG → ${chatId}]: ${text.slice(0, 80)}...`);
      return { message_id: 1 };
    },
  };
  const adapters = createDeliveryManager(mockTelegram);
  console.log('Adapters:', adapters.map(a => a.name).join(', '));

  const results = await deliverPlan(adapters, 964254039, 'Test delivery message');
  console.log('Delivery results:', JSON.stringify(results));

  // Test LLM call
  console.log('\n=== LLM ===');
  console.log('LLM_BASE_URL:', process.env.LLM_BASE_URL || 'http://127.0.0.1:8080/v1');
  console.log('LLM_MODEL:', process.env.LLM_MODEL || 'hermes');

  try {
    const plan = await generateMealPlan(answers, { locale: 'en' });
    console.log('Plan length:', plan.length, 'chars');
    console.log('Plan preview:', plan.slice(0, 200));
    const cuisine = parseCuisine(plan);
    console.log('Parsed cuisine:', cuisine);
    console.log('✅ LLM generation verified');
  } catch (err: any) {
    console.error('❌ LLM failed:', err.message);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
