"""TypeDB attribute types - base classes for defining attributes."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime as datetime_type
from typing import (
    TYPE_CHECKING,
    Annotated,
    Any,
    ClassVar,
    Literal,
    TypeVar,
    get_args,
    get_origin,
)

from pydantic import GetCoreSchemaHandler
from pydantic_core import core_schema

# TypeVars for proper type checking
# bound= tells type checkers these types accept their base types
StrValue = TypeVar("StrValue", bound=str)
IntValue = TypeVar("IntValue", bound=int)
FloatValue = TypeVar("FloatValue", bound=float)
BoolValue = TypeVar("BoolValue", bound=bool)
DateTimeValue = TypeVar("DateTimeValue", bound=datetime_type)

T = TypeVar("T")

# Key marker type
type Key[T] = Annotated[T, "key"]
# Unique marker type
type Unique[T] = Annotated[T, "unique"]


@dataclass
class EntityFlags:
    """Metadata flags for Entity classes.

    Args:
        type_name: TypeDB type name (defaults to lowercase class name)
        abstract: Whether this is an abstract entity type

    Example:
        class Person(Entity):
            flags = EntityFlags(type_name="person")
            name: Name

        class AbstractPerson(Entity):
            flags = EntityFlags(abstract=True)
            name: Name
    """

    type_name: str | None = None
    abstract: bool = False


@dataclass
class RelationFlags:
    """Metadata flags for Relation classes.

    Args:
        type_name: TypeDB type name (defaults to lowercase class name)
        abstract: Whether this is an abstract relation type

    Example:
        class Employment(Relation):
            flags = RelationFlags(type_name="employment")
            employee: Role = Role("employee", Person)
    """

    type_name: str | None = None
    abstract: bool = False


class Attribute(ABC):
    """Base class for TypeDB attributes.

    Attributes in TypeDB are value types that can be owned by entities and relations.

    Attribute instances can store values, allowing type-safe construction:
        Name("Alice")  # Creates Name instance with value "Alice"
        Age(30)        # Creates Age instance with value 30

    Example:
        class Name(String):
            pass

        class Age(Long):
            pass

        class Person(Entity):
            name: Name
            age: Age

        # Both patterns work:
        person1 = Person(name="Alice", age=30)              # Raw values
        person2 = Person(name=Name("Alice"), age=Age(30))   # Attribute instances
    """

    # Class-level metadata
    value_type: ClassVar[str]  # TypeDB value type (string, long, double, boolean, datetime)
    abstract: ClassVar[bool] = False

    # Instance-level configuration (set via __init_subclass__)
    _attr_name: str | None = None
    _is_key: bool = False
    _supertype: str | None = None

    # Instance-level value storage
    _value: Any = None

    @abstractmethod
    def __init__(self, value: Any = None):
        """Initialize attribute with a value.

        Args:
            value: The value to store in this attribute instance
        """
        self._value = value

    def __init_subclass__(cls, **kwargs):
        """Called when a subclass is created."""
        super().__init_subclass__(**kwargs)

        # Always set the attribute name for each new subclass (don't inherit from parent)
        # This ensures Name(String) gets _attr_name="name", not "string"
        cls._attr_name = cls.__name__.lower()

    @property
    def value(self) -> Any:
        """Get the stored value."""
        return self._value

    def __str__(self) -> str:
        """String representation returns the stored value."""
        return str(self._value) if self._value is not None else ""

    def __repr__(self) -> str:
        """Repr shows the attribute type and value."""
        cls_name = self.__class__.__name__
        return f"{cls_name}({self._value!r})"

    @classmethod
    def get_attribute_name(cls) -> str:
        """Get the TypeDB attribute name."""
        return cls._attr_name or cls.__name__.lower()

    @classmethod
    def get_value_type(cls) -> str:
        """Get the TypeDB value type."""
        return cls.value_type

    @classmethod
    def is_key(cls) -> bool:
        """Check if this attribute is a key."""
        return cls._is_key

    @classmethod
    def is_abstract(cls) -> bool:
        """Check if this attribute is abstract."""
        return cls.abstract

    @classmethod
    def get_supertype(cls) -> str | None:
        """Get the supertype if this attribute extends another."""
        return cls._supertype

    @classmethod
    def to_schema_definition(cls) -> str:
        """Generate TypeQL schema definition for this attribute.

        Returns:
            TypeQL schema definition string
        """
        attr_name = cls.get_attribute_name()
        value_type = cls.get_value_type()

        # Check if this is a subtype
        if cls._supertype:
            definition = f"attribute {attr_name} sub {cls._supertype}, value {value_type}"
        else:
            definition = f"attribute {attr_name}, value {value_type}"

        if cls.abstract:
            definition += ", abstract"

        return definition + ";"


class String(Attribute):
    """String attribute type that accepts str values.

    Example:
        class Name(String):
            pass

        class Email(String):
            pass

        # With Literal for type safety
        class Status(String):
            pass

        status: Literal["active", "inactive"] | Status
    """

    value_type: ClassVar[str] = "string"

    def __init__(self, value: str):
        """Initialize String attribute with a string value.

        Args:
            value: The string value to store
        """
        super().__init__(value)

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: type[StrValue], handler: GetCoreSchemaHandler
    ) -> core_schema.CoreSchema:
        """Pydantic validation: accept str values, Literal types, or attribute instances."""

        # Serializer to extract value from attribute instances
        def serialize_string(value: Any) -> str:
            if isinstance(value, cls):
                return str(value._value) if value._value is not None else ""
            return str(value)

        # Check if source_type is a Literal type
        if get_origin(source_type) is Literal:
            # Extract literal values
            literal_values = get_args(source_type)
            # Convert tuple to list for literal_schema
            return core_schema.with_info_plain_validator_function(
                lambda v, _: v._value if isinstance(v, cls) else v,
                serialization=core_schema.plain_serializer_function_ser_schema(
                    serialize_string,
                    return_schema=core_schema.str_schema(),
                ),
            )

        # Default: accept str or attribute instance, serialize to str
        def validate_string(value: Any) -> str:
            if isinstance(value, cls):
                return value._value if value._value is not None else ""
            return str(value)

        return core_schema.with_info_plain_validator_function(
            lambda v, _: validate_string(v),
            serialization=core_schema.plain_serializer_function_ser_schema(
                serialize_string,
                return_schema=core_schema.str_schema(),
            ),
        )


class Long(Attribute):
    """Long integer attribute type that accepts int values.

    Example:
        class Age(Long):
            pass

        class Count(Long):
            pass

        # With Literal for type safety
        class Priority(Long):
            pass

        priority: Literal[1, 2, 3] | Priority
    """

    value_type: ClassVar[str] = "long"

    def __init__(self, value: int):
        """Initialize Long attribute with an integer value.

        Args:
            value: The integer value to store
        """
        super().__init__(value)

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: type[IntValue], handler: GetCoreSchemaHandler
    ) -> core_schema.CoreSchema:
        """Pydantic validation: accept int values, Literal types, or attribute instances."""

        # Serializer to extract value from attribute instances
        def serialize_long(value: Any) -> int:
            if isinstance(value, cls):
                return int(value._value) if value._value is not None else 0
            return int(value)

        # Check if source_type is a Literal type
        if get_origin(source_type) is Literal:
            # Extract literal values
            literal_values = get_args(source_type)
            # Convert tuple to list for literal_schema
            return core_schema.with_info_plain_validator_function(
                lambda v, _: v._value if isinstance(v, cls) else v,
                serialization=core_schema.plain_serializer_function_ser_schema(
                    serialize_long,
                    return_schema=core_schema.int_schema(),
                ),
            )

        # Default: accept int or attribute instance, serialize to int
        def validate_long(value: Any) -> int:
            if isinstance(value, cls):
                return value._value if value._value is not None else 0
            return int(value)

        return core_schema.with_info_plain_validator_function(
            lambda v, _: validate_long(v),
            serialization=core_schema.plain_serializer_function_ser_schema(
                serialize_long,
                return_schema=core_schema.int_schema(),
            ),
        )

    @classmethod
    def __class_getitem__(cls, item: object) -> type["Long"]:
        """Allow generic subscription for type checking (e.g., Long[int])."""
        return cls


class Double(Attribute):
    """Double precision float attribute type that accepts float values.

    Example:
        class Price(Double):
            pass

        class Score(Double):
            pass
    """

    value_type: ClassVar[str] = "double"

    def __init__(self, value: float):
        """Initialize Double attribute with a float value.

        Args:
            value: The float value to store
        """
        super().__init__(value)

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: type[FloatValue], handler: GetCoreSchemaHandler
    ) -> core_schema.CoreSchema:
        """Pydantic validation: accept float values or attribute instances."""

        # Serializer to extract value from attribute instances
        def serialize_double(value: Any) -> float:
            if isinstance(value, cls):
                return float(value._value) if value._value is not None else 0.0
            return float(value)

        # Validator: accept float or attribute instance, serialize to float
        def validate_double(value: Any) -> float:
            if isinstance(value, cls):
                return value._value if value._value is not None else 0.0
            return float(value)

        return core_schema.with_info_plain_validator_function(
            lambda v, _: validate_double(v),
            serialization=core_schema.plain_serializer_function_ser_schema(
                serialize_double,
                return_schema=core_schema.float_schema(),
            ),
        )

    @classmethod
    def __class_getitem__(cls, item: object) -> type["Double"]:
        """Allow generic subscription for type checking (e.g., Double[float])."""
        return cls


class Boolean(Attribute):
    """Boolean attribute type that accepts bool values.

    Example:
        class IsActive(Boolean):
            pass

        class IsVerified(Boolean):
            pass
    """

    value_type: ClassVar[str] = "boolean"

    def __init__(self, value: bool):
        """Initialize Boolean attribute with a bool value.

        Args:
            value: The boolean value to store
        """
        super().__init__(value)

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: type[BoolValue], handler: GetCoreSchemaHandler
    ) -> core_schema.CoreSchema:
        """Pydantic validation: accept bool values or attribute instances."""

        # Serializer to extract value from attribute instances
        def serialize_boolean(value: Any) -> bool:
            if isinstance(value, cls):
                return bool(value._value) if value._value is not None else False
            return bool(value)

        # Validator: accept bool or attribute instance, serialize to bool
        def validate_boolean(value: Any) -> bool:
            if isinstance(value, cls):
                return value._value if value._value is not None else False
            return bool(value)

        return core_schema.with_info_plain_validator_function(
            lambda v, _: validate_boolean(v),
            serialization=core_schema.plain_serializer_function_ser_schema(
                serialize_boolean,
                return_schema=core_schema.bool_schema(),
            ),
        )

    @classmethod
    def __class_getitem__(cls, item: object) -> type["Boolean"]:
        """Allow generic subscription for type checking (e.g., Boolean[bool])."""
        return cls


class DateTime(Attribute):
    """DateTime attribute type that accepts datetime values.

    Example:
        class CreatedAt(DateTime):
            pass

        class UpdatedAt(DateTime):
            pass
    """

    value_type: ClassVar[str] = "datetime"

    def __init__(self, value: datetime_type):
        """Initialize DateTime attribute with a datetime value.

        Args:
            value: The datetime value to store
        """
        super().__init__(value)

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: type[DateTimeValue], handler: GetCoreSchemaHandler
    ) -> core_schema.CoreSchema:
        """Pydantic validation: accept datetime values or attribute instances."""

        # Serializer to extract value from attribute instances
        def serialize_datetime(value: Any) -> datetime_type:
            if isinstance(value, cls):
                return value._value if value._value is not None else datetime_type.now()
            return (
                value
                if isinstance(value, datetime_type)
                else datetime_type.fromisoformat(str(value))
            )

        # Validator: accept datetime or attribute instance
        def validate_datetime(value: Any) -> datetime_type:
            if isinstance(value, cls):
                return value._value if value._value is not None else datetime_type.now()
            return (
                value
                if isinstance(value, datetime_type)
                else datetime_type.fromisoformat(str(value))
            )

        return core_schema.with_info_plain_validator_function(
            lambda v, _: validate_datetime(v),
            serialization=core_schema.plain_serializer_function_ser_schema(
                serialize_datetime,
                return_schema=core_schema.datetime_schema(),
            ),
        )

    @classmethod
    def __class_getitem__(cls, item: object) -> type["DateTime"]:
        """Allow generic subscription for type checking (e.g., DateTime[datetime])."""
        return cls


class Card:
    """Cardinality marker for multi-value attribute ownership.

    IMPORTANT: Card() should only be used with list[Type] annotations.
    For optional single values, use Optional[Type] instead.

    Args:
        min: Minimum cardinality (default: None, which means unspecified)
        max: Maximum cardinality (default: None, which means unbounded)

    Examples:
        tags: list[Tag] = Flag(Card(min=2))      # @card(2..) - at least two
        jobs: list[Job] = Flag(Card(1, 5))       # @card(1..5) - one to five
        ids: list[ID] = Flag(Key, Card(min=1))   # @key @card(1..)

        # INCORRECT - use Optional[Type] instead:
        # age: Age = Flag(Card(min=0, max=1))    # ❌ Wrong!
        age: Optional[Age]                        # ✓ Correct
    """

    def __init__(self, *args: int, min: int | None = None, max: int | None = None):
        """Initialize cardinality marker.

        Supports both positional and keyword arguments:
        - Card(1, 5) → min=1, max=5
        - Card(min=2) → min=2, max=None (unbounded)
        - Card(max=5) → min=0, max=5 (defaults min to 0)
        - Card(min=0, max=10) → min=0, max=10
        """
        if args:
            # Positional arguments: Card(1, 5) or Card(2)
            if len(args) == 1:
                self.min = args[0]
                self.max = max  # Use keyword arg if provided
            elif len(args) == 2:
                self.min = args[0]
                self.max = args[1]
            else:
                raise ValueError("Card accepts at most 2 positional arguments")
        else:
            # Keyword arguments only
            # If only max is specified, default min to 0
            if min is None and max is not None:
                self.min = 0
                self.max = max
            else:
                self.min = min
                self.max = max


@dataclass
class AttributeFlags:
    """Metadata for attribute ownership.

    Represents TypeDB ownership annotations like @key, @card(min..max), @unique.

    Example:
        class Person(Entity):
            name: Name = Flag(Key)                    # @key (implies @card(1..1))
            email: Email = Flag(Unique)               # @unique @card(1..1)
            age: Optional[Age]                        # @card(0..1) - no Flag needed
            tags: list[Tag] = Flag(Card(min=2))       # @card(2..)
            jobs: list[Job] = Flag(Card(1, 5))        # @card(1..5)
    """

    is_key: bool = False
    is_unique: bool = False
    card_min: int | None = None
    card_max: int | None = None
    has_explicit_card: bool = False  # Track if Card(...) was explicitly used

    def to_typeql_annotations(self) -> list[str]:
        """Convert to TypeQL annotations like @key, @card(0..5).

        Rules:
        - @key implies @card(1..1), so never output @card with @key
        - @unique with @card(1..1) is redundant, so omit @card in that case
        - Otherwise, always output @card if cardinality is specified

        Returns:
            List of TypeQL annotation strings
        """
        annotations = []
        if self.is_key:
            annotations.append("@key")
        if self.is_unique:
            annotations.append("@unique")

        # Only output @card if:
        # 1. Not a @key (since @key always implies @card(1..1))
        # 2. Not (@unique with default @card(1..1))
        should_output_card = self.card_min is not None or self.card_max is not None

        if should_output_card and not self.is_key:
            # Check if it's @unique with default (1,1) - if so, omit @card
            is_default_card = self.card_min == 1 and self.card_max == 1
            if not (self.is_unique and is_default_card):
                min_val = self.card_min if self.card_min is not None else 0
                if self.card_max is not None:
                    # Use .. syntax for range: @card(1..5)
                    annotations.append(f"@card({min_val}..{self.card_max})")
                else:
                    # Unbounded max: @card(min..)
                    annotations.append(f"@card({min_val}..)")

        return annotations


def Flag(*annotations: Any) -> Annotated[Any, AttributeFlags]:
    """Create attribute flags for Key, Unique, and Card markers.

    Usage:
        field: Type = Flag(Key)                   # @key (implies @card(1..1))
        field: Type = Flag(Unique)                # @unique @card(1..1)
        field: list[Type] = Flag(Card(min=2))     # @card(2..)
        field: list[Type] = Flag(Card(1, 5))      # @card(1..5)
        field: Type = Flag(Key, Unique)           # @key @unique
        field: list[Type] = Flag(Key, Card(min=1)) # @key @card(1..)

    For optional single values, use Optional[Type] instead:
        field: Optional[Type]  # @card(0..1) - no Flag needed

    Args:
        *annotations: Variable number of Key, Unique, or Card marker instances

    Returns:
        AttributeFlags instance with the specified flags

    Example:
        class Person(Entity):
            flags = EntityFlags(type_name="person")
            name: Name = Flag(Key)                    # @key (implies @card(1..1))
            email: Email = Flag(Key, Unique)          # @key @unique
            age: Optional[Age]                        # @card(0..1)
            tags: list[Tag] = Flag(Card(min=2))       # @card(2..)
            jobs: list[Job] = Flag(Card(1, 5))        # @card(1..5)
    """
    flags = AttributeFlags()
    has_card = False

    for ann in annotations:
        if ann is Key:
            flags.is_key = True
        elif ann is Unique:
            flags.is_unique = True
        elif isinstance(ann, Card):
            # Extract cardinality from Card instance
            flags.card_min = ann.min
            flags.card_max = ann.max
            flags.has_explicit_card = True
            has_card = True

    # If Key was used but no Card, set default card(1,1)
    if flags.is_key and not has_card:
        flags.card_min = 1
        flags.card_max = 1

    return flags
