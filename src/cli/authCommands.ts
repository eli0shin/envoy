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
            process.stdout.write('\n'); // New line after hidden input
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
  process.stdout.write(question + '\n');
  options.forEach((option, index) => {
    const hint = option.hint ? ` (${option.hint})` : '';
    process.stdout.write(`  ${index + 1}. ${option.label}${hint}\n`);
  });

  while (true) {
    const choice = await promptUser(
      'Select option (1-' + options.length + '): '
    );
    const index = parseInt(choice) - 1;

    if (index >= 0 && index < options.length) {
      return options[index].value;
    }

    process.stdout.write('Invalid selection. Please try again.\n');
  }
}

/**
 * Login command implementation
 */
export async function loginCommand(): Promise<void> {
  process.stdout.write('\n🔐 Authentication Setup\n\n');

  // For now, we only support Anthropic, but designed for extensibility
  const providers = [
    { label: 'Anthropic (Claude)', value: 'anthropic', hint: 'recommended' },
  ];

  const provider = await selectOption('Select provider:', providers);

  if (provider === 'anthropic') {
    await handleAnthropicLogin();
  } else {
    process.stderr.write('❌ Unsupported provider\n');
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
    process.stdout.write('\n🚀 Starting OAuth flow...\n');

    const { url, verifier } = await AnthropicOAuth.authorize();

    process.stdout.write('📱 Opening browser for authorization...\n');
    process.stdout.write("If the browser doesn't open automatically, visit:\n");
    process.stdout.write(`   ${url}\n`);

    try {
      await open(url);
    } catch {
      process.stdout.write('⚠️  Failed to open browser automatically\n');
    }

    process.stdout.write(
      "\nAfter authorizing, you'll be redirected to a page with an authorization code.\n"
    );
    const code = await promptUser('📋 Paste the authorization code here: ');

    if (!code) {
      process.stderr.write('❌ No authorization code provided\n');
      process.exit(1);
    }

    process.stdout.write('🔄 Exchanging code for tokens...\n');
    await AnthropicOAuth.exchange(code, verifier);

    process.stdout.write('✅ OAuth login successful!\n');
    process.stdout.write('🎉 You can now use Claude Pro/Max features\n');
  } catch (error) {
    process.stderr.write(
      `❌ OAuth login failed: ${error instanceof Error ? error.message : error}\n`
    );
    process.exit(1);
  }
}

/**
 * Handle API key login flow
 */
async function handleApiKeyLogin(): Promise<void> {
  try {
    process.stdout.write('\n🔑 API Key Setup\n');
    process.stdout.write('Get your API key from: https://console.anthropic.com/\n');

    const apiKey = await promptUser('Enter your Anthropic API key: ', true);

    if (!apiKey) {
      process.stderr.write('❌ No API key provided\n');
      process.exit(1);
    }

    // Basic validation - Anthropic API keys start with 'sk-ant-'
    if (!apiKey.startsWith('sk-ant-')) {
      process.stdout.write(
        '⚠️  Warning: API key format looks unusual (should start with sk-ant-)\n'
      );
      const confirm = await promptUser('Continue anyway? (y/N): ');
      if (!confirm.toLowerCase().startsWith('y')) {
        process.stderr.write('❌ Cancelled\n');
        process.exit(1);
      }
    }

    await CredentialStore.set('anthropic', {
      type: 'api',
      key: apiKey,
    });

    process.stdout.write('✅ API key saved successfully!\n');
  } catch (error) {
    process.stderr.write(
      `❌ API key setup failed: ${error instanceof Error ? error.message : error}\n`
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
      process.stdout.write('ℹ️  No stored credentials found\n');
      return;
    }

    process.stdout.write('\n🚪 Logout\n\n');

    if (providers.length === 1) {
      const provider = providers[0];
      const credential = credentials[provider];

      process.stdout.write(`Removing ${provider} credentials (${credential.type})\n`);
      const confirm = await promptUser('Are you sure? (y/N): ');

      if (confirm.toLowerCase().startsWith('y')) {
        await CredentialStore.remove(provider);
        process.stdout.write('✅ Logged out successfully\n');
      } else {
        process.stdout.write('❌ Cancelled\n');
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
        process.stdout.write('✅ Logged out successfully\n');
      } else {
        process.stdout.write('❌ Cancelled\n');
      }
    }
  } catch (error) {
    process.stderr.write(
      `❌ Logout failed: ${error instanceof Error ? error.message : error}\n`
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

    process.stdout.write(`\n📄 Stored Credentials (${authFilePath})\n\n`);

    if (Object.keys(credentials).length === 0) {
      process.stdout.write('ℹ️  No stored credentials\n');
      process.stdout.write('   Run: npx . auth login\n');
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

      process.stdout.write(`  ${provider}: ${authType} ${status}\n`);
    }
  } catch (error) {
    process.stderr.write(
      `❌ Failed to list credentials: ${error instanceof Error ? error.message : error}\n`
    );
    process.exit(1);
  }
}

/**
 * Status command implementation
 */
export async function statusCommand(): Promise<void> {
  try {
    process.stdout.write('\n📊 Authentication Status\n\n');

    const credentials = await CredentialStore.list();

    if (Object.keys(credentials).length === 0) {
      process.stdout.write('❌ No authentication configured\n');
      process.stdout.write('   Run: npx . auth login\n');
      return;
    }

    // Check Anthropic specifically since it's our main provider
    const anthropicCreds = credentials.anthropic;
    if (anthropicCreds) {
      if (anthropicCreds.type === 'oauth') {
        const isAuthenticated = await AnthropicOAuth.isAuthenticated();
        if (isAuthenticated) {
          process.stdout.write('✅ Anthropic: OAuth authenticated (Claude Pro/Max)\n');
        } else {
          process.stdout.write('❌ Anthropic: OAuth token expired/invalid\n');
          process.stdout.write('   Run: npx . auth login\n');
        }
      } else {
        process.stdout.write('✅ Anthropic: API key configured\n');
      }
    } else {
      process.stdout.write('❌ Anthropic: Not configured\n');
      process.stdout.write('   Run: npx . auth login\n');
    }
  } catch (error) {
    process.stderr.write(
      `❌ Status check failed: ${error instanceof Error ? error.message : error}\n`
    );
    process.exit(1);
  }
}
