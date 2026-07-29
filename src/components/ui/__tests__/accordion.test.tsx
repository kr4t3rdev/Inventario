import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

describe('Accordion accessibility contract', () => {
  it('keeps collapsed content hidden and updates relationships when toggled', async () => {
    const user = userEvent.setup();

    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="first-item">
          <AccordionTrigger>First question</AccordionTrigger>
          <AccordionContent>First answer</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    const trigger = screen.getByRole('button', { name: 'First question' });
    const panel = screen.getAllByRole('region', { hidden: true })[1];

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('hidden');
    expect(panel).toHaveAttribute('aria-labelledby', trigger.id);
    expect(trigger.parentElement).toHaveAttribute('data-state', 'closed');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(panel).not.toHaveAttribute('hidden');
    expect(panel).toHaveAttribute('id');
    expect(panel).toHaveAttribute('role', 'region');
    expect(panel).toHaveAttribute('aria-labelledby', trigger.id);
    expect(panel).toHaveAttribute('data-state', 'open');
    expect(trigger.parentElement).toHaveAttribute('data-state', 'open');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(panel).toHaveAttribute('hidden');
    expect(panel).toHaveAttribute('data-state', 'closed');
    expect(trigger.parentElement).toHaveAttribute('data-state', 'closed');
  });

  it('keeps relationships unique across accordions that reuse item values', () => {
    render(
      <>
        <Accordion type="single" collapsible>
          <AccordionItem value="item-0">
            <AccordionTrigger>First accordion</AccordionTrigger>
            <AccordionContent>First content</AccordionContent>
          </AccordionItem>
        </Accordion>
        <Accordion type="single" collapsible>
          <AccordionItem value="item-0">
            <AccordionTrigger>Second accordion</AccordionTrigger>
            <AccordionContent>Second content</AccordionContent>
          </AccordionItem>
        </Accordion>
      </>,
    );

    const triggers = screen.getAllByRole('button');
    expect(triggers[0].id).not.toBe(triggers[1].id);
    expect(triggers[0]).toHaveAttribute('aria-controls');
    expect(triggers[1]).toHaveAttribute('aria-controls');
    expect(triggers[0].getAttribute('aria-controls')).not.toBe(
      triggers[1].getAttribute('aria-controls'),
    );
  });
});
