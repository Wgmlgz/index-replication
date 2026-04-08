package planner

type FullAlgorithm struct{}

func NewFullAlgorithm() *FullAlgorithm {
	return &FullAlgorithm{}
}

func (a *FullAlgorithm) Key() string {
	return "full"
}

func (a *FullAlgorithm) Plan(input Input) (Output, error) {
	return planPerCurrency(input, a.planSingleCurrency)
}

func (a *FullAlgorithm) planSingleCurrency(_ string, input Input) (Output, error) {
	// TODO: implement one-currency planning math.
	return Output{
		Items:    []Item{},
		Warnings: []string{},
		Money:    append([]Money(nil), input.Money...),
	}, nil
}
