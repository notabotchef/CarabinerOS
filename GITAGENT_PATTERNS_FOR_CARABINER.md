# GitAgent Patterns: Actionable Takeaways for CarabinerOS

**Date**: 2026-03-25
**Focus**: Implementation-ready patterns, not theory

---

## 1. Agent Versioning Pattern

GitAgent insight: **Git tags = agent versions. Every change is auditable.**

### For CarabinerOS

Currently, Agent Zero runs a single "carabiner agent" that handles chat, memory, and routing. Prompts live in Python (hard-coded or env vars). No semantic versioning, no rollback capability, no audit trail of prompt changes.

**Proposed approach**:

```bash
# Create a .agents/ directory at project root
carabiner-os/
├── .agents/
│   ├── order-fulfillment/
│   │   ├── agent.yaml
│   │   ├── SOUL.md
│   │   ├── RULES.md
│   │   ├── skills/
│   │   └── memory/MEMORY.md
│   ├── inventory-management/
│   └── financial-reconciliation/
├── python/
├── frontend/
└── carabiner/
```

Each agent is a sub-repository with its own versioning:

```bash
cd .agents/order-fulfillment
git tag -a v2.1.0 -m "Added ApplePay support + payment validation"
git log --oneline  # See all prompt/rule changes

# Rollback if needed
git checkout v2.0.3
```

**Implementation**:

1. Wrap `python/api/` chat endpoints to inject agent version in logs:
   ```python
   @app.route('/message', methods=['POST'])
   async def message():
       agent_version = subprocess.run(
           ['git', '-C', '.agents/order-fulfillment', 'describe', '--tags'],
           capture_output=True, text=True
       ).stdout.strip()
       # Log: agent_version=v2.1.0, prompt_hash=abc123
   ```

2. Store agent version in `A0Snapshot` (sent to frontend):
   ```typescript
   interface A0Snapshot {
     agent_version: string;  // "v2.1.0"
     git_hash: string;       // commit hash
     // ...existing fields
   }
   ```

3. Add rollback endpoint:
   ```bash
   POST /api/agents/{agent_name}/rollback
   { "version": "v2.0.3" }
   # Checks out .agents/{agent_name} to that tag, restarts Flask
   ```

---

## 2. Segregation of Duties (SOD) Pattern

GitAgent insight: **Declare roles, conflicts, and handoff workflows in YAML. Validate at deploy time.**

### For CarabinerOS

Restaurant operations have natural role boundaries:

- **Manager** (create/edit/override)
- **Staff** (execute/confirm/report)
- **Kitchen** (receive/prepare/handoff)
- **Auditor** (verify/escalate/document)

**Proposed approach**:

Create `.agents/core/DUTIES.md`:

```markdown
# Restaurant Operations: Segregation of Duties

## Roles

| Role | Agent | Permissions | Examples |
|------|-------|-------------|----------|
| Manager | manager-agent | create, edit, override, approve | Create orders, adjust inventory, override food safety rules |
| Staff | staff-agent | execute, confirm, report | Confirm receipt, log prep time, submit daily count |
| Kitchen | kitchen-agent | execute, report | Receive orders, track temperature, confirm readiness |
| Auditor | audit-agent | verify, escalate, archive | Spot-check orders, reconcile inventory, generate compliance reports |

## Conflict Matrix

No single agent may hold both roles:

- [Manager, Auditor] — Manager can't approve their own overrides
- [Staff, Auditor] — Staff can't verify their own execution
- [Kitchen, Manager] — Kitchen can't override food safety rules without approval

## Handoff Workflows

### Order Fulfillment
1. Manager creates order → submit
2. Staff confirms receipt → confirm
3. Kitchen prepares → report temperature
4. (Auditor spot-checks) → verify
5. Manager marks complete → reconcile

### Inventory Adjustment
1. Staff counts → submit count
2. Manager reviews variance → approve or reject
3. (Auditor archives) → log

### Food Safety Override
1. Any agent flags concern → escalate
2. Manager reviews + approves override → override
3. Kitchen implements + logs → report
4. Auditor verifies compliance → verify

## Enforcement: STRICT

Any attempt to assign conflicting roles to the same agent will fail validation and block deployment.
```

Add to `.agents/core/agent.yaml`:

```yaml
agents:
  manager:
    description: Restaurant manager operations
    duties: [manager-role]

  staff:
    description: Front-of-house and miscellaneous tasks
    duties: [staff-role]

  kitchen:
    description: Kitchen operations and food handling
    duties: [kitchen-role]

  auditor:
    description: Compliance and audit tracking
    duties: [auditor-role]

compliance:
  segregation_of_duties:
    roles:
      - id: manager-role
        description: Create, edit, approve, override
        permissions: [create, edit, override, approve]
      - id: staff-role
        description: Execute, confirm, report
        permissions: [execute, confirm, report]
      - id: kitchen-role
        description: Receive, prepare, handoff
        permissions: [execute, report]
      - id: auditor-role
        description: Verify, escalate, document
        permissions: [verify, escalate, archive]

    conflicts:
      - [manager-role, auditor-role]
      - [staff-role, auditor-role]
      - [kitchen-role, manager-role]

    handoffs:
      - action: create_order
        required_roles: [manager-role, staff-role]
        approval_required: false
      - action: override_food_safety
        required_roles: [kitchen-role, manager-role]
        approval_required: true
      - action: approve_inventory_adjustment
        required_roles: [staff-role, manager-role]
        approval_required: true

    isolation:
      state: full
      credentials: separate

    enforcement: strict
```

**Implementation**:

1. Wrap Agent Zero's delegation logic:
   ```python
   # In carabiner/api/handlers/delegation.py

   async def validate_sod(current_agent: str, target_agent: str, action: str):
       """Check if delegation violates SOD"""
       duties = load_agent_duties()

       current_roles = duties['agents'][current_agent]['roles']
       target_roles = duties['agents'][target_agent]['roles']

       for conflict in duties['compliance']['segregation_of_duties']['conflicts']:
           if set(conflict).issubset(current_roles | target_roles):
               raise SODViolation(
                   f"Cannot delegate {action}: {current_agent} "
                   f"({current_roles}) and {target_agent} ({target_roles}) "
                   f"have conflicting roles"
               )

   @app.route('/api/delegate', methods=['POST'])
   async def delegate():
       current_agent = request.json['from_agent']
       target_agent = request.json['to_agent']
       action = request.json['action']

       await validate_sod(current_agent, target_agent, action)
       # Proceed with delegation
   ```

2. Add SOD validation to startup:
   ```python
   @app.before_first_request
   async def validate_sod_config():
       """Ensure agent configuration doesn't violate SOD"""
       duties = load_agent_duties()

       # Check that no agent is assigned conflicting roles
       for agent_name, roles in duties['compliance']['segregation_of_duties']['assignments'].items():
           for conflict_pair in duties['compliance']['segregation_of_duties']['conflicts']:
               if set(conflict_pair).issubset(roles):
                   raise RuntimeError(
                       f"Agent {agent_name} assigned conflicting roles: {conflict_pair}"
                   )
   ```

3. Log all handoffs with approvals:
   ```python
   # In carabiner/db/models.py

   class AgentHandoff(Base):
       __tablename__ = "agent_handoffs"

       id = Column(String, primary_key=True, default=lambda: str(uuid4()))
       timestamp = Column(DateTime, default=datetime.utcnow)
       from_agent = Column(String, nullable=False)
       to_agent = Column(String, nullable=False)
       action = Column(String, nullable=False)
       approval_required = Column(Boolean, default=False)
       approved_by = Column(String, nullable=True)
       approval_timestamp = Column(DateTime, nullable=True)
       reason = Column(String)

       # Query: "Show all overrides and who approved them"
   ```

---

## 3. Deterministic Workflows (SkillsFlow) Pattern

GitAgent insight: **Multi-step workflows are fixed sequences, not LLM discretion.**

### For CarabinerOS

Currently, Agent Zero runs open-ended conversational loops. For restaurant workflows (order → payment → kitchen → delivery), this introduces unnecessary branching and error handling complexity.

**Proposed approach**:

Create `.agents/order-fulfillment/workflows/order-pipeline.yaml`:

```yaml
name: order-pipeline
description: End-to-end order fulfillment workflow
version: 1.0.0

triggers:
  - order_created

inputs:
  - name: order_id
    type: uuid
    required: true

outputs:
  - name: order_status
    type: string  # pending, ready, delivered
  - name: timeline
    type: array   # [timestamp, step, status]

steps:
  - id: validate-order
    action: Validate order format and required fields
    skill: order-validation
    inputs:
      order_id: ${{ trigger.order_id }}
    outputs: [valid, errors]
    compliance:
      audit_level: full

  - id: check-payment
    action: Verify payment method and authorization
    depends_on: [validate-order]
    conditions:
      - ${{ steps.validate-order.outputs.valid == true }}
    skill: payment-processing
    inputs:
      order_id: ${{ trigger.order_id }}
    outputs: [payment_status, payment_id]
    compliance:
      requires_approval: false
      audit_level: full

  - id: estimate-time
    action: Calculate prep time based on menu items and kitchen capacity
    depends_on: [check-payment]
    conditions:
      - ${{ steps.check-payment.outputs.payment_status == 'approved' }}
    tool: prep-time-estimator
    inputs:
      items: ${{ trigger.order.items }}
      kitchen_occupancy: ${{ context.kitchen.current_orders }}
    outputs: [estimated_minutes, confidence]
    compliance:
      audit_level: summary

  - id: reserve-ingredients
    action: Lock inventory for order items (prevent over-selling)
    depends_on: [estimate-time]
    skill: inventory-reservation
    inputs:
      items: ${{ trigger.order.items }}
    outputs: [reserved, shortage_items]
    compliance:
      audit_level: full

  - id: send-to-kitchen
    action: Route order to kitchen display system (KDS)
    depends_on: [reserve-ingredients, payment-confirmed]
    conditions:
      - ${{ steps.reserve-ingredients.outputs.reserved == true }}
      - ${{ steps.check-payment.outputs.payment_status == 'approved' }}
    skill: kitchen-assignment
    inputs:
      order_id: ${{ trigger.order_id }}
      items: ${{ trigger.order.items }}
      temperature_requirements: ${{ trigger.order.special_notes }}
      estimated_ready_at: ${{ steps.estimate-time.outputs.estimated_minutes | add_to_now }}
    outputs: [kitchen_station, ticket_number]
    compliance:
      audit_level: full

  - id: notify-customer
    action: Send confirmation + estimated time to customer
    depends_on: [send-to-kitchen]
    skill: customer-notification
    inputs:
      order_id: ${{ trigger.order_id }}
      message_type: order_confirmed
      estimated_time: ${{ steps.estimate-time.outputs.estimated_minutes }}
      channels: [sms, email]
    outputs: [notification_id]
    compliance:
      audit_level: summary

  - id: kitchen-reports-ready
    action: Wait for kitchen to confirm order ready (via KDS or manual)
    depends_on: [send-to-kitchen]
    conditions:
      - ${{ trigger.order.wait_for_ready == true }}  # Some orders are "eat immediately"
    tool: listen-to-event
    inputs:
      event_type: kitchen_order_ready
      timeout_seconds: 1200  # 20 minutes max
    outputs: [ready_timestamp, kitchen_confirmed]
    compliance:
      audit_level: summary

  - id: final-quality-check
    action: (Optional) Staff spot-checks order against ticket
    depends_on: [kitchen-reports-ready]
    conditions:
      - ${{ trigger.order.high_value == true }}  # Only for orders > $50
    skill: quality-check
    inputs:
      order_id: ${{ trigger.order_id }}
      expected_items: ${{ trigger.order.items }}
    outputs: [quality_ok, discrepancies]
    compliance:
      requires_approval: false
      audit_level: summary

  - id: mark-ready
    action: Update order status to READY in database
    depends_on: [kitchen-reports-ready]
    tool: order-status-update
    inputs:
      order_id: ${{ trigger.order_id }}
      status: ready
      ready_at: ${{ now() }}
    outputs: [success]

  - id: escalate-on-error
    action: If any step fails, escalate to manager
    error_handling: on_any_failure
    skill: escalation
    inputs:
      order_id: ${{ trigger.order_id }}
      failed_step: ${{ context.failed_step }}
      error: ${{ context.error }}
    outputs: [escalation_id]
    compliance:
      requires_approval: true
      audit_level: full

error_handling:
  on_validation_failure: reject_order
  on_payment_failure: notify_customer
  on_kitchen_failure: escalate
  escalation_target: manager-agent
  max_retries:
    check-payment: 3
    send-to-kitchen: 1  # Don't retry sending to kitchen; escalate instead
```

**Implementation**:

1. Create a workflow engine in `carabiner/workflows/executor.py`:

```python
# carabiner/workflows/executor.py

from typing import Any, Dict, List
import yaml
from carabiner.db import Order, OrderTimeline
from carabiner.api.handlers import (
    OrderValidation, PaymentProcessing, InventoryReservation,
    KitchenAssignment, CustomerNotification
)

class WorkflowExecutor:
    """Execute deterministic order workflows"""

    def __init__(self, workflow_path: str):
        with open(workflow_path) as f:
            self.workflow = yaml.safe_load(f)
        self.context = {}
        self.steps_completed = []

    async def execute(self, trigger_data: Dict[str, Any]) -> Dict[str, Any]:
        """Run workflow from start to end"""
        order_id = trigger_data['order_id']
        order = await Order.get(order_id)

        for step in self.workflow['steps']:
            result = await self._execute_step(step, trigger_data)

            if not result['success']:
                # Check error_handling for this step
                await self._handle_error(step, result['error'], order_id)
                return result

            # Log to timeline
            await OrderTimeline.create(
                order_id=order_id,
                step=step['id'],
                action=step['action'],
                status='completed',
                timestamp=datetime.utcnow()
            )

            self.steps_completed.append(step['id'])

        return {'success': True, 'order_id': order_id}

    async def _execute_step(self, step: Dict, trigger_data: Dict) -> Dict:
        """Execute a single step, respecting depends_on and conditions"""

        # Check dependencies
        if 'depends_on' in step:
            for dep in step['depends_on']:
                if dep not in self.steps_completed:
                    return {'success': False, 'error': f'Dependency not met: {dep}'}

        # Check conditions
        if 'conditions' in step:
            for condition in step['conditions']:
                if not self._eval_condition(condition):
                    # Skip step, but mark as skipped (not failed)
                    return {'success': True, 'skipped': True}

        # Execute skill/tool/agent
        if 'skill' in step:
            handler = self._get_skill_handler(step['skill'])
            result = await handler.execute(step['inputs'])
        elif 'tool' in step:
            result = await self._execute_tool(step['tool'], step['inputs'])
        elif 'agent' in step:
            result = await self._delegate_to_agent(step['agent'], step['inputs'])

        # Store outputs in context
        for output_name in step.get('outputs', []):
            self.context[f"steps.{step['id']}.outputs.{output_name}"] = result.get(output_name)

        return {'success': True, 'result': result}

    def _eval_condition(self, condition_str: str) -> bool:
        """Evaluate condition like '${{ steps.validate-order.outputs.valid == true }}'"""
        # Simple templating: replace ${{ ... }} with evaluated Python
        import re
        pattern = r'\$\{\{\s*(.*?)\s*\}\}'

        def evaluate(match):
            expr = match.group(1)
            # Safely evaluate with context
            return str(eval(expr, {"steps": self.context}))

        result_str = re.sub(pattern, evaluate, condition_str)
        return result_str == 'True'

# Usage:
executor = WorkflowExecutor('.agents/order-fulfillment/workflows/order-pipeline.yaml')
result = await executor.execute({'order_id': 'order-123'})
```

2. Expose workflow status in API:

```python
@app.route('/api/orders/<order_id>/timeline', methods=['GET'])
async def get_order_timeline(order_id: str):
    """Get step-by-step execution timeline"""
    timeline = await OrderTimeline.filter(order_id=order_id).all()
    return {
        'order_id': order_id,
        'steps': [
            {
                'step': t.step,
                'action': t.action,
                'status': t.status,
                'timestamp': t.timestamp.isoformat(),
                'error': t.error
            }
            for t in timeline
        ]
    }
```

3. Add frontend timeline widget:

```typescript
// frontend/src/components/order-timeline.tsx

interface OrderTimeline {
  steps: {
    step: string;
    action: string;
    status: 'pending' | 'completed' | 'skipped' | 'failed';
    timestamp?: string;
    error?: string;
  }[];
}

export function OrderTimeline({ orderId }: { orderId: string }) {
  const [timeline, setTimeline] = React.useState<OrderTimeline | null>(null);

  React.useEffect(() => {
    fetch(`/api/orders/${orderId}/timeline`)
      .then(r => r.json())
      .then(setTimeline);
  }, [orderId]);

  return (
    <div className="space-y-2">
      {timeline?.steps.map(step => (
        <div key={step.step} className="flex items-center gap-3 p-2 rounded border">
          <div className={`w-2 h-2 rounded-full ${
            step.status === 'completed' ? 'bg-emerald-500' :
            step.status === 'failed' ? 'bg-red-500' :
            step.status === 'skipped' ? 'bg-gray-400' :
            'bg-amber-500'
          }`} />
          <div className="flex-1">
            <div className="font-medium">{step.action}</div>
            {step.timestamp && (
              <div className="text-xs text-gray-500">{new Date(step.timestamp).toLocaleTimeString()}</div>
            )}
            {step.error && (
              <div className="text-xs text-red-600">{step.error}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 4. Compliance as Code Pattern

GitAgent insight: **Health codes and labor laws are agent constraints, enforced at validation time.**

### For CarabinerOS

Create `.agents/core/compliance/health-code.md`:

```markdown
# Health Code Compliance

## Temperature Monitoring
- Frozen items must reach ≤0°F
- Refrigerated items must reach ≤41°F
- Hot items must reach ≥165°F (poultry: 165°F, ground meat: 160°F)
- Required verification: Every 4 hours during service

## Allergen Handling
- Staff must confirm allergens with customer before preparation
- Cross-contamination prevention: Separate utensils, cutting boards, fryers
- Required tracking: Order ID + customer name + allergen flags

## Time-Temperature Control (TTC)
- Prepared food held > 4 hours at room temp must be discarded
- Cooked food > 2 hours must be reheated before serving

## Pest Control
- No food prep on surfaces visited by pests
- Daily inspection of food storage areas

## Handwashing
- 20 seconds minimum with soap
- After using restroom, before food prep, after handling raw food
```

Add to `.agents/core/agent.yaml`:

```yaml
compliance:
  frameworks: [health_code, labor_law]

  # Health department regulations
  supervision:
    human_in_the_loop: conditional
    escalation_triggers:
      - action_type: temperature_override
      - action_type: discard_food_decision
      - action_type: allergen_handling_error
      - temperature_below: 165  # For hot foods
    kill_switch: true

  # Recordkeeping for inspections
  recordkeeping:
    audit_logging: true
    log_format: structured_json
    retention_period: 1y
    log_contents:
      - temperature_checks
      - allergen_confirmations
      - food_discards
      - cleaning_logs

  # Data governance
  data_governance:
    pii_handling: redact
    data_classification: confidential
```

**Implementation**:

1. Create health code validator in `carabiner/compliance/health_code.py`:

```python
# carabiner/compliance/health_code.py

from enum import Enum
from datetime import datetime, timedelta

class FoodType(Enum):
    HOT = 165  # Poultry
    HOT_GROUND = 160
    FROZEN = 0
    REFRIGERATED = 41

class HealthCodeValidator:
    """Enforce health code rules"""

    TEMP_CHECK_INTERVAL = timedelta(hours=4)
    MAX_ROOM_TEMP_TIME = timedelta(hours=4)
    MAX_REHEATABLE_TIME = timedelta(hours=2)

    async def validate_temperature(self,
                                  food_type: FoodType,
                                  current_temp: float) -> tuple[bool, str]:
        """Check if food temperature meets requirements"""

        if current_temp < food_type.value:
            return False, f"Temperature {current_temp}°F below minimum {food_type.value}°F"
        return True, "OK"

    async def validate_allergen_handling(self,
                                        order_id: str,
                                        customer_allergens: List[str]) -> bool:
        """Ensure allergens were confirmed with customer"""
        order = await Order.get(order_id)

        if not order.allergen_confirmed:
            return False  # Escalate: staff must confirm with customer

        if set(customer_allergens) != set(order.allergens):
            return False  # Escalate: allergen mismatch

        return True

    async def validate_time_control(self,
                                   item_id: str,
                                   prepared_at: datetime) -> tuple[bool, str]:
        """Check if food has exceeded safe storage time"""

        now = datetime.utcnow()
        elapsed = now - prepared_at

        if elapsed > self.MAX_ROOM_TEMP_TIME:
            return False, f"Item prepared {elapsed.total_seconds() / 3600:.1f}h ago — must discard"

        if elapsed > self.MAX_REHEATABLE_TIME:
            return False, "Item must be reheated before serving"

        return True, "OK"
```

2. Wrap order execution to enforce health checks:

```python
@app.route('/api/orders/<order_id>/kitchen/confirm-ready', methods=['POST'])
async def confirm_order_ready(order_id: str):
    """Kitchen staff confirms order is ready"""
    order = await Order.get(order_id)

    # Validate temperature for each item
    validator = HealthCodeValidator()
    for item in order.items:
        temp_ok, msg = await validator.validate_temperature(
            FoodType[item.type.upper()],
            request.json['temperatures'].get(item.id)
        )

        if not temp_ok:
            # Escalate to manager
            await escalate_to_manager(
                reason=msg,
                order_id=order_id,
                action='temperature_correction'
            )
            return {'ok': False, 'error': msg, 'requires_escalation': True}

    # Validate allergens confirmed
    if order.has_allergens:
        allergen_ok = await validator.validate_allergen_handling(
            order_id, order.allergen_notes
        )
        if not allergen_ok:
            return {'ok': False, 'error': 'Allergen confirmation required'}

    # Validate time-temperature control
    for item in order.items:
        time_ok, msg = await validator.validate_time_control(
            item.id, item.prepared_at
        )
        if not time_ok:
            await escalate_to_manager(
                reason=msg,
                order_id=order_id,
                action='discard_food_decision'
            )
            return {'ok': False, 'error': msg, 'requires_escalation': True}

    # All checks passed
    order.status = 'ready'
    await order.save()

    return {'ok': True, 'order_id': order_id}
```

3. Generate compliance report for health inspectors:

```python
@app.route('/api/compliance/health-code-report', methods=['GET'])
async def health_code_report():
    """Generate audit trail for health inspector"""
    date_from = request.args.get('from')
    date_to = request.args.get('to')

    checks = await HealthCodeCheck.filter(
        date__gte=date_from,
        date__lte=date_to
    ).all()

    return {
        'report_date': datetime.utcnow().isoformat(),
        'period': {'from': date_from, 'to': date_to},
        'summary': {
            'total_orders': len(checks),
            'temperature_failures': len([c for c in checks if c.type == 'temperature' and not c.passed]),
            'allergen_failures': len([c for c in checks if c.type == 'allergen' and not c.passed]),
        },
        'details': [
            {
                'order_id': c.order_id,
                'timestamp': c.timestamp.isoformat(),
                'type': c.type,
                'check': c.description,
                'passed': c.passed,
                'escalated_to': c.escalated_to,
            }
            for c in checks
        ]
    }
```

---

## 5. Progressive Disclosure Pattern

GitAgent insight: **Don't load all context upfront. Load skills/knowledge on-demand.**

### For CarabinerOS

Currently, every agent interaction loads:
- All skills descriptions
- All knowledge documents
- All regulatory rules
- All historical memory

This bloats the system prompt and slows down responses.

**Proposed approach**:

1. Create "always-load" knowledge for essential skills:

```yaml
# .agents/order-fulfillment/knowledge/index.yaml

documents:
  - path: kitchen-procedures.md
    always_load: true      # Load this in every order workflow

  - path: allergen-database.md
    always_load: true      # Must be available for food safety

  - path: payment-processors.md
    always_load: false     # Load only when needed

  - path: menu-history.md
    always_load: false     # Historical; not needed for current orders
```

2. Load selectively based on action:

```python
# carabiner/api/handlers/chat.py

async def get_agent_context(action: str, order_id: str = None) -> str:
    """Load context selectively based on action"""

    context_parts = []

    # Always load core identity
    context_parts.append(load_file('.agents/order-fulfillment/SOUL.md'))

    # Load based on action
    if action == 'create_order':
        context_parts.append(load_file('.agents/order-fulfillment/knowledge/kitchen-procedures.md'))
        context_parts.append(load_file('.agents/order-fulfillment/knowledge/allergen-database.md'))

    elif action == 'payment':
        context_parts.append(load_file('.agents/order-fulfillment/knowledge/payment-processors.md'))

    elif action == 'delivery':
        context_parts.append(load_file('.agents/order-fulfillment/knowledge/delivery-procedures.md'))

    # Load historical context if relevant
    if order_id:
        order = await Order.get(order_id)
        if order.has_issues:
            context_parts.append(load_file('.agents/order-fulfillment/memory/MEMORY.md'))

    return '\n\n'.join(context_parts)

@app.route('/message', methods=['POST'])
async def message():
    order_id = request.json.get('order_id')
    action = request.json.get('action')

    context = await get_agent_context(action, order_id)
    prompt = request.json['prompt']

    # Send to LLM with selective context
    response = await llm.generate(
        system_prompt=context,
        user_prompt=prompt
    )

    return {'ok': True, 'response': response}
```

---

## 6. Implementation Roadmap

### Phase 1: Versioning (Week 1-2)
- [ ] Create `.agents/core/agent.yaml` + `SOUL.md`
- [ ] Add `git tag` support to Flask startup
- [ ] Log `agent_version` in all API responses
- [ ] Wire A0Snapshot to include version

### Phase 2: SOD (Week 2-3)
- [ ] Define roles in `DUTIES.md` (manager, staff, kitchen, auditor)
- [ ] Add SOD validator to startup checks
- [ ] Implement escalation handler for conflicting roles
- [ ] Create `AgentHandoff` model + logging

### Phase 3: Workflows (Week 3-5)
- [ ] Build workflow executor in Python
- [ ] Create `order-pipeline.yaml` as template
- [ ] Add `/api/orders/{id}/timeline` endpoint
- [ ] Build frontend timeline widget

### Phase 4: Compliance (Week 5-6)
- [ ] Create health code validator
- [ ] Wire temperature/allergen/time checks to order execution
- [ ] Build audit report endpoints
- [ ] Add compliance dashboard to frontend

### Phase 5: Progressive Disclosure (Week 6)
- [ ] Index knowledge documents (always_load vs. on-demand)
- [ ] Implement selective context loading
- [ ] Measure token savings + response latency

---

## Summary: GitAgent as a Discipline

GitAgent's real value for CarabinerOS isn't the tooling — it's the **discipline**:

1. **Version everything** — Git commits are your audit trail
2. **Separate concerns** — Roles are declared, not implicit
3. **Workflow rigidity** — Order pipelines follow fixed steps, not LLM whimsy
4. **Compliance transparency** — Rules are in YAML, validated at deploy, audited at runtime
5. **Selective loading** — Context is lean, not bloated

These patterns apply whether you use GitAgent's CLI or not. The philosophy is portable.
