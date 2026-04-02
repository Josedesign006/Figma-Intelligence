import type { Meta, StoryObj } from '@storybook/react';
import Button from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'destructive'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    leadingIcon: { control: 'boolean' },
    trailingIcon: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
  },
  args: {
    children: 'Button',
    variant: 'primary',
    size: 'sm',
    leadingIcon: true,
    trailingIcon: false,
    disabled: false,
    loading: false,
    fullWidth: false,
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {(['primary', 'secondary', 'ghost', 'destructive'] as const).map((variant) => (
        <div key={variant} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ width: 100, fontFamily: 'IBM Plex Sans', fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>{variant}</span>
          {(['sm', 'md', 'lg'] as const).map((size) => (
            <Button key={`${variant}-${size}`} variant={variant} size={size}>Button</Button>
          ))}
          <Button variant={variant} size="md" disabled>Disabled</Button>
          <Button variant={variant} size="md" loading>Loading</Button>
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const WithTrailingIcon: Story = {
  args: { trailingIcon: true, leadingIcon: false, size: 'md' },
};

export const FullWidth: Story = {
  args: { fullWidth: true, size: 'lg' },
  decorators: [(Story) => <div style={{ width: 320 }}><Story /></div>],
};
