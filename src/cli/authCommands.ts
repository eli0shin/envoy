/**
 * CLI authentication commands
 * Provides user-friendly authentication management interface
 */

import open from 'open';
import { AnthropicOAuth, CredentialStore } from '../auth/index.js';
import * as readline from 'readline';

/**
 * Create readline interface for user input
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user for input with optional hidden input (for passwords)
 */
function promptUser(
  question: string,
  hidden: boolean = false
): Promise<string> {
  return new Promise(resolve => {
    const rl = createReadlineInterface();

    if (hidden) {
      // Hide input for sensitive data
      const stdin = process.stdin;
      stdin.setRawMode?.(true);

      let input = '';
      const onData = (char: Buffer) => {
        const c = char.toString();

        switch (c) {
          case '\n':
          case '\r':
          case '\u0004': // Ctrl+D
            stdin.setRawMode?.(false);
            stdin.removeListener('data', onData);
            rl.close();
            console.log(''); // New line after hidden input
            resolve(input);
            break;
          case '\u0003': // Ctrl+C
            stdin.setRawMode?.(false);
            stdin.removeListener('data', onData);
            rl.close();
            process.exit(0);
            break;
          case '\u007f': // Backspace
            if (input.length > 0) {
              input = input.slice(0, -1);
              process.stdout.write('\b \b');
            }
            break;
          default:
            input += c;
            process.stdout.write('*');
            break;
        }
      };

      process.stdout.write(question);
      stdin.on('data', onData);
    } else {
      rl.question(question, answer => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

/**
 * Prompt user to select from options
 */
async function selectOption(
  question: string,
  options: Array<{ label: string; value: string; hint?: string }>
): Promise<string> {
  console.log(question);
  options.forEach((option, index) => {
    const hint = option.hint ? ` (${option.hint})` : '';
    console.log(`  ${index + 1}. ${option.label}${hint}`);
  });

  while (true) {
    const choice = await promptUser(
      'Select option (1-' + options.length + '): '
    );
    const index = parseInt(choice) - 1;

    if (index >= 0 && index < options.length) {
      return options[index].value;
    }

    console.log('Invalid selection. Please try again.');
  }
}

/**
 * Login command implementation
 */
export async function loginCommand(): Promise<void> {
  console.log('\n🔐 Authentication Setup\n');

  // For now, we only support Anthropic, but designed for extensibility
  const providers = [
    { label: 'Anthropic (Claude)', value: 'anthropic', hint: 'recommended' },
  ];

  const provider = await selectOption('Select provider:', providers);

  if (provider === 'anthropic') {
    await handleAnthropicLogin();
  } else {
    console.log('❌ Unsupported provider');
    process.exit(1);
  }
}

/**
 * Handle Anthropic-specific login flow
 */
async function handleAnthropicLogin(): Promise<void> {
  const methods = [
    { label: 'Claude Pro/Max (OAuth)', value: 'oauth' },
    { label: 'API Key', value: 'api' },
  ];

  const method = await selectOption('Select authentication method:', methods);

  if (method === 'oauth') {
    await handleOAuthLogin();
  } else if (method === 'api') {
    await handleApiKeyLogin();
  }
}

/**
 * Handle OAuth login flow
 */
async function handleOAuthLogin(): Promise<void> {
  try {
    console.log('\n🚀 Starting OAuth flow...');

    const { url, verifier } = await AnthropicOAuth.authorize();

    console.log('📱 Opening browser for authorization...');
    console.log("If the browser doesn't open automatically, visit:");
    console.log(`   ${url}`);

    try {
      await open(url);
    } catch {
      console.log('⚠️  Failed to open browser automatically');
    }

    console.log(
      "\nAfter authorizing, you'll be redirected to a page with an authorization code."
    );
    const code = await promptUser('📋 Paste the authorization code here: ');

    if (!code) {
      console.log('❌ No authorization code provided');
      process.exit(1);
    }

    console.log('🔄 Exchanging code for tokens...');
    await AnthropicOAuth.exchange(code, verifier);

    console.log('✅ OAuth login successful!');
    console.log('🎉 You can now use Claude Pro/Max features');
  } catch (error) {
    console.error(
      '❌ OAuth login failed:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

/**
 * Handle API key login flow
 */
async function handleApiKeyLogin(): Promise<void> {
  try {
    console.log('\n🔑 API Key Setup');
    console.log('Get your API key from: https://console.anthropic.com/');

    const apiKey = await promptUser('Enter your Anthropic API key: ', true);

    if (!apiKey) {
      console.log('❌ No API key provided');
      process.exit(1);
    }

    // Basic validation - Anthropic API keys start with 'sk-ant-'
    if (!apiKey.startsWith('sk-ant-')) {
      console.log(
        '⚠️  Warning: API key format looks unusual (should start with sk-ant-)'
      );
      const confirm = await promptUser('Continue anyway? (y/N): ');
      if (!confirm.toLowerCase().startsWith('y')) {
        console.log('❌ Cancelled');
        process.exit(1);
      }
    }

    await CredentialStore.set('anthropic', {
      type: 'api',
      key: apiKey,
    });

    console.log('✅ API key saved successfully!');
  } catch (error) {
    console.error(
      '❌ API key setup failed:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

/**
 * Logout command implementation
 */
export async function logoutCommand(): Promise<void> {
  try {
    const credentials = await CredentialStore.list();
    const providers = Object.keys(credentials);

    if (providers.length === 0) {
      console.log('ℹ️  No stored credentials found');
      return;
    }

    console.log('\n🚪 Logout\n');

    if (providers.length === 1) {
      const provider = providers[0];
      const credential = credentials[provider];

      console.log(`Removing ${provider} credentials (${credential.type})`);
      const confirm = await promptUser('Are you sure? (y/N): ');

      if (confirm.toLowerCase().startsWith('y')) {
        await CredentialStore.remove(provider);
        console.log('✅ Logged out successfully');
      } else {
        console.log('❌ Cancelled');
      }
    } else {
      // Multiple providers - let user choose
      const options = providers.map(provider => ({
        label: `${provider} (${credentials[provider].type})`,
        value: provider,
      }));

      const provider = await selectOption(
        'Select provider to logout:',
        options
      );

      const confirm = await promptUser('Are you sure? (y/N): ');
      if (confirm.toLowerCase().startsWith('y')) {
        await CredentialStore.remove(provider);
        console.log('✅ Logged out successfully');
      } else {
        console.log('❌ Cancelled');
      }
    }
  } catch (error) {
    console.error(
      '❌ Logout failed:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

/**
 * List command implementation
 */
export async function listCommand(): Promise<void> {
  try {
    const credentials = await CredentialStore.list();
    const authFilePath = CredentialStore.getAuthFilePath();

    console.log(`\n📄 Stored Credentials (${authFilePath})\n`);

    if (Object.keys(credentials).length === 0) {
      console.log('ℹ️  No stored credentials');
      console.log('   Run: npx . auth login');
      return;
    }

    for (const [provider, credential] of Object.entries(credentials)) {
      const authType = credential.type;
      let status = '';

      if (credential.type === 'oauth') {
        const isValid = await AnthropicOAuth.isAuthenticated();
        status = isValid ? '✅ valid' : '❌ expired/invalid';
      } else {
        status = '🔑 api-key';
      }

      console.log(`  ${provider}: ${authType} ${status}`);
    }
  } catch (error) {
    console.error(
      '❌ Failed to list credentials:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

/**
 * Status command implementation
 */
export async function statusCommand(): Promise<void> {
  try {
    console.log('\n📊 Authentication Status\n');

    const credentials = await CredentialStore.list();

    if (Object.keys(credentials).length === 0) {
      console.log('❌ No authentication configured');
      console.log('   Run: npx . auth login');
      return;
    }

    // Check Anthropic specifically since it's our main provider
    const anthropicCreds = credentials.anthropic;
    if (anthropicCreds) {
      if (anthropicCreds.type === 'oauth') {
        const isAuthenticated = await AnthropicOAuth.isAuthenticated();
        if (isAuthenticated) {
          console.log('✅ Anthropic: OAuth authenticated (Claude Pro/Max)');
        } else {
          console.log('❌ Anthropic: OAuth token expired/invalid');
          console.log('   Run: npx . auth login');
        }
      } else {
        console.log('✅ Anthropic: API key configured');
      }
    } else {
      console.log('❌ Anthropic: Not configured');
      console.log('   Run: npx . auth login');
    }
  } catch (error) {
    console.error(
      '❌ Status check failed:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}
