"""Base Attribute class for TypeDB attribute types."""

from abc import ABC, abstractmethod
from typing import Any, ClassVar

# TypeDB built-in type names that cannot be used for attributes
TYPEDB_BUILTIN_TYPES = {"thing", "entity", "relation", "attribute"}


def _validate_attribute_name(attr_name: str, class_name: str) -> None:
    """Validate that an attribute name doesn't conflict with TypeDB built-ins.

    Args:
        attr_name: The attribute name to validate
        class_name: The Python class name (for error messages)

    Raises:
        ValueError: If attribute name conflicts with a TypeDB built-in type
    """
    if attr_name.lower() in TYPEDB_BUILTIN_TYPES:
        raise ValueError(
            f"Attribute name '{attr_name}' for class '{class_name}' conflicts with TypeDB built-in type. "
            f"Built-in types are: {', '.join(sorted(TYPEDB_BUILTIN_TYPES))}. "
            f"Please rename your attribute class to avoid this conflict."
        )


class Attribute(ABC):
    """Base class for TypeDB attributes.

    Attributes in TypeDB are value types that can be owned by entities and relations.

    Attribute instances can store values, allowing type-safe construction:
        Name("Alice")  # Creates Name instance with value "Alice"
        Age(30)        # Creates Age instance with value 30

    Example:
        class Name(String):
            pass

        class Age(Integer):
            pass

        class Person(Entity):
            name: Name
            age: Age

        # Direct instantiation with wrapped types (best practice):
        person = Person(name=Name("Alice"), age=Age(30))
    """

    # Class-level metadata
    value_type: ClassVar[str]  # TypeDB value type (string, integer, double, boolean, datetime)
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

        # Validate attribute name doesn't conflict with TypeDB built-ins
        _validate_attribute_name(cls._attr_name, cls.__name__)

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

    def __eq__(self, other: object) -> bool:
        """Compare attribute with another attribute instance.

        For strict type safety, Attribute instances do NOT compare equal to raw values.
        To access the raw value, use the `.value` property.

        Examples:
            Age(20) == Age(20)  # True (same type, same value)
            Age(20) == Id(20)   # False (different types!)
            Age(20) == 20       # False (not equal to raw value!)
            Age(20).value == 20 # True (access raw value explicitly)
        """
        if isinstance(other, Attribute):
            # Compare two attribute instances: both type and value must match
            return type(self) is type(other) and self._value == other._value
        # Do not compare with non-Attribute objects (strict type safety)
        return False

    def __hash__(self) -> int:
        """Make attribute hashable based on its type and value."""
        return hash((type(self), self._value))

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
